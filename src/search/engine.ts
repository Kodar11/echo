import path from 'path';
import {
  getAllFiles,
  getFileById,
  getFileCount,
} from '../database/index.js';
import { getPostingsForTerm } from '../database/postings.js';
import { getAllTerms, TermRecord } from '../database/terms.js';
import { tokenizeQuery } from '../indexer/tokenizer.js';
import { computeBm25Score, type Bm25Context } from './bm25.js';
import { findFuzzyMatches } from './fuzzySearch.js';
import { findPhraseMatches } from './phraseSearch.js';
import { computeCompositeScore } from './ranking.js';
import { generateSnippet } from './snippets.js';
import { Trie } from './trie.js';

const FUZZY_MAX_DISTANCE = 1;
const RESULT_LIMIT = 50;

export class SearchEngine {
  private trie: Trie;
  private termCache: Map<string, TermRecord>;

  constructor() {
    this.trie = new Trie();
    this.termCache = new Map();
  }

  rebuildIndex(): void {
    const terms = getAllTerms();
    this.termCache.clear();
    this.trie.clear();
    for (const term of terms) {
      this.trie.insert(term.term);
      this.termCache.set(term.term, term);
    }
  }

  getSuggestions(prefix: string, limit = 10): string[] {
    if (!prefix || prefix.length === 0) return [];
    const normalized = prefix.toLowerCase();
    return this.trie.find(normalized).slice(0, limit);
  }

  async search(query: string): Promise<SearchResult[]> {
    const queryTerms = tokenizeQuery(query);
    if (queryTerms.length === 0) return [];

    const totalDocs = getFileCount();
    if (totalDocs === 0) return [];

    const files = getAllFiles();
    const totalDocLength = files.reduce((sum, f) => sum + f.doc_length, 0);
    const avgDocLength = totalDocLength / files.length || 1;
    const context: Bm25Context = { totalDocs, avgDocLength };

    // Query term -> matched index terms
    const matchedTermsPerQuery = new Map<number, string[]>();
    const allMatchedTermIds = new Set<number>();

    for (let i = 0; i < queryTerms.length; i++) {
      const qt = queryTerms[i];
      const matched = this.expandTerm(qt);
      matchedTermsPerQuery.set(i, matched.terms);
      for (const termId of matched.termIds) {
        allMatchedTermIds.add(termId);
      }
    }

    if (allMatchedTermIds.size === 0) return [];

    // Load postings for all matched terms
    const postingsByTermId = new Map<
      number,
      ReturnType<typeof getPostingsForTerm>
    >();
    for (const termId of allMatchedTermIds) {
      postingsByTermId.set(termId, getPostingsForTerm(termId));
    }

    // Aggregate per file: BM25 score + which query terms matched
    const fileScores = new Map<
      number,
      { score: number; matchedQueryTerms: Set<number>; matchedTerms: Set<string> }
    >();

    for (let queryIndex = 0; queryIndex < queryTerms.length; queryIndex++) {
      const matchedTerms = matchedTermsPerQuery.get(queryIndex) ?? [];
      for (const termText of matchedTerms) {
        const termRecord = this.termCache.get(termText);
        if (!termRecord) continue;
        const postings = postingsByTermId.get(termRecord.id) ?? [];
        for (const posting of postings) {
          const fileRecord = getFileById(posting.fileId);
          if (!fileRecord) continue;

          const entry = fileScores.get(posting.fileId);
          const bm25 = computeBm25Score(
            posting,
            fileRecord.doc_length,
            termRecord.document_frequency,
            context
          );

          if (entry) {
            entry.score += bm25;
            entry.matchedQueryTerms.add(queryIndex);
            entry.matchedTerms.add(termText);
          } else {
            fileScores.set(posting.fileId, {
              score: bm25,
              matchedQueryTerms: new Set([queryIndex]),
              matchedTerms: new Set([termText]),
            });
          }
        }
      }
    }

    // Phrase detection using exact query terms (only for multi-term queries)
    const phraseMatches =
      queryTerms.length >= 2
        ? this.findExactPhraseMatches(queryTerms, postingsByTermId)
        : new Map<number, number[]>();

    // Build final results
    const results: SearchResult[] = [];
    for (const [fileId, data] of fileScores.entries()) {
      const fileRecord = getFileById(fileId);
      if (!fileRecord) continue;

      const phrasePositions = phraseMatches.get(fileId);
      const phraseMatchCount = phrasePositions?.length ?? 0;
      const compositeScore = computeCompositeScore(
        data.score,
        data.matchedQueryTerms.size,
        phraseMatchCount
      );

      const snippet = await generateSnippet(
        fileRecord.path,
        Array.from(data.matchedTerms),
        phrasePositions
      );

      results.push({
        fileId,
        path: fileRecord.path,
        filename: path.basename(fileRecord.path),
        size: fileRecord.size,
        modifiedTime: fileRecord.modified_time,
        score: compositeScore,
        snippet,
        matchedTerms: Array.from(data.matchedTerms),
        phraseMatch: phraseMatchCount > 0,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, RESULT_LIMIT);
  }

  private expandTerm(queryTerm: string): { terms: string[]; termIds: number[] } {
    const terms: string[] = [];
    const termIds: number[] = [];

    // Exact match
    const exact = this.termCache.get(queryTerm);
    if (exact) {
      terms.push(queryTerm);
      termIds.push(exact.id);
    }

    // Prefix matches
    if (queryTerm.length >= 2) {
      const prefixMatches = this.trie.find(queryTerm);
      for (const term of prefixMatches) {
        if (term === queryTerm) continue;
        const record = this.termCache.get(term);
        if (record) {
          terms.push(term);
          termIds.push(record.id);
        }
      }
    }

    // Fuzzy matches
    const allTerms = Array.from(this.termCache.keys());
    const fuzzyMatches = findFuzzyMatches(
      queryTerm,
      allTerms,
      FUZZY_MAX_DISTANCE
    );
    for (const term of fuzzyMatches) {
      if (term === queryTerm) continue;
      const record = this.termCache.get(term);
      if (record && !termIds.includes(record.id)) {
        terms.push(term);
        termIds.push(record.id);
      }
    }

    return { terms, termIds };
  }

  private findExactPhraseMatches(
    queryTerms: string[],
    postingsByTermId: Map<number, ReturnType<typeof getPostingsForTerm>>
  ): Map<number, number[]> {
    const exactPostings: ReturnType<typeof getPostingsForTerm>[] = [];
    for (const qt of queryTerms) {
      const termRecord = this.termCache.get(qt);
      if (!termRecord) {
        return new Map(); // Can't do phrase match if any exact term is missing
      }
      exactPostings.push(postingsByTermId.get(termRecord.id) ?? []);
    }
    return findPhraseMatches(exactPostings);
  }
}

export const searchEngine = new SearchEngine();
