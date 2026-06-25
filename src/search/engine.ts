import path from 'path';
import type { FileRecord } from '../database/files.js';
import {
  getAllFiles,
  getFileById,
  getFileCount,
  getFolders,
} from '../database/index.js';
import type { Posting } from '../database/postings.js';
import { getPostingsForTerm } from '../database/postings.js';
import { getAllTerms, TermRecord } from '../database/terms.js';
import { computeBm25Score, type Bm25Context } from './bm25.js';
import { evaluateFilter } from './filters.js';
import { findFuzzyMatches } from './fuzzySearch.js';
import { findPhraseMatches } from './phraseSearch.js';
import { parseQuery, type QueryNode } from './queryParser.js';
import { RankingPipeline } from './ranking/pipeline.js';
import type { CandidateResult, RankingContext } from './ranking/types.js';
import { generateSnippets } from './snippets.js';
import { Trie } from './trie.js';

const FUZZY_MAX_DISTANCE = 1;
const RESULT_LIMIT = 50;

export interface SearchOptions {
  query: string;
  folderIds?: number[];
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  durationMs: number;
}

interface TermEvaluation {
  node: QueryNode;
  termTexts: string[];
  termIds: number[];
  postingsByTermId: Map<number, Posting[]>;
}

interface PhraseEvaluation {
  node: QueryNode;
  terms: string[];
  positionsByFile: Map<number, number[]>;
}

interface FileMatchData {
  bm25Score: number;
  matchedTerms: Set<string>;
  matchedQueryTerms: Set<number>;
  phrasePositions: number[];
}

export class SearchEngine {
  private trie: Trie;
  private termCache: Map<string, TermRecord>;
  private rankingPipeline: RankingPipeline;

  constructor() {
    this.trie = new Trie();
    this.termCache = new Map();
    this.rankingPipeline = new RankingPipeline();
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

  async search(options: SearchOptions): Promise<SearchResponse> {
    const startTime = performance.now();
    const { query, folderIds } = options;

    const parsed = parseQuery(query);
    if (!parsed.root) {
      return { results: [], totalCount: 0, durationMs: 0 };
    }

    const totalDocs = getFileCount();
    if (totalDocs === 0) {
      return { results: [], totalCount: 0, durationMs: 0 };
    }

    const files = getAllFiles();
    const scopedFiles = this.applyScope(files, folderIds);

    const totalDocLength = files.reduce((sum, f) => sum + f.doc_length, 0);
    const avgDocLength = totalDocLength / files.length || 1;
    const bm25Context: Bm25Context = { totalDocs, avgDocLength };

    const { terms, phrases } = this.collectLeaves(parsed.root);
    const termEvaluations = this.evaluateTerms(terms, bm25Context);
    const phraseEvaluations = this.evaluatePhrases(phrases);

    const fileMatches = new Map<number, FileMatchData>();
    this.buildTermMatches(termEvaluations, fileMatches, bm25Context);

    const matchingFileIds: number[] = [];
    for (const file of scopedFiles) {
      if (this.evaluateNode(parsed.root, file, fileMatches, phraseEvaluations)) {
        matchingFileIds.push(file.id);
      }
    }

    if (matchingFileIds.length === 0) {
      return { results: [], totalCount: 0, durationMs: Math.round(performance.now() - startTime) };
    }

    const candidates = this.buildCandidates(
      matchingFileIds,
      fileMatches,
      phraseEvaluations
    );

    const phraseTerms = phraseEvaluations.map((p) => p.terms);
    const rankingContext: RankingContext = {
      query,
      queryNode: parsed.root,
      phraseTerms,
      bm25Context,
    };

    const ranked = this.rankingPipeline.rank(candidates, rankingContext);
    const limited = ranked.slice(0, RESULT_LIMIT);

    const results = await this.buildResults(limited, phraseEvaluations);

    return {
      results,
      totalCount: matchingFileIds.length,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  private applyScope(files: FileRecord[], folderIds?: number[]): FileRecord[] {
    if (!folderIds || folderIds.length === 0) return files;

    const folders = getFolders(); // imported from database/index.js
    const selectedPaths = folders
      .filter((f) => folderIds.includes(f.id))
      .map((f) => f.path.toLowerCase());

    if (selectedPaths.length === 0) return files;

    return files.filter((file) =>
      selectedPaths.some((prefix) => file.path.toLowerCase().startsWith(prefix))
    );
  }

  private collectLeaves(root: QueryNode): { terms: QueryNode[]; phrases: QueryNode[] } {
    const terms: QueryNode[] = [];
    const phrases: QueryNode[] = [];

    const walk = (node: QueryNode) => {
      if (node.type === 'term' || node.type === 'filter') {
        if (node.type === 'term') terms.push(node);
      } else if (node.type === 'phrase') {
        phrases.push(node);
      } else if (node.type === 'and' || node.type === 'or') {
        walk(node.left);
        walk(node.right);
      } else if (node.type === 'not') {
        walk(node.child);
      }
    };

    walk(root);
    return { terms, phrases };
  }

  private evaluateTerms(terms: QueryNode[], bm25Context: Bm25Context): TermEvaluation[] {
    return terms.map((node) => {
      if (node.type !== 'term') {
        return { node, termTexts: [], termIds: [], postingsByTermId: new Map() };
      }
      const { terms: expanded, termIds } = this.expandTerm(node.value);
      const postingsByTermId = new Map<number, Posting[]>();
      for (const termId of termIds) {
        postingsByTermId.set(termId, getPostingsForTerm(termId));
      }
      return { node, termTexts: expanded, termIds, postingsByTermId };
    });
  }

  private evaluatePhrases(phrases: QueryNode[]): PhraseEvaluation[] {
    return phrases.map((node) => {
      if (node.type !== 'phrase') {
        return { node, terms: [], positionsByFile: new Map() };
      }
      const termIds: number[] = [];
      for (const term of node.terms) {
        const record = this.termCache.get(term);
        if (!record) {
          return { node, terms: node.terms, positionsByFile: new Map() };
        }
        termIds.push(record.id);
      }

      const postings = termIds.map((id) => getPostingsForTerm(id));
      const positionsByFile = findPhraseMatches(postings);
      return { node, terms: node.terms, positionsByFile };
    });
  }

  private buildTermMatches(
    evaluations: TermEvaluation[],
    fileMatches: Map<number, FileMatchData>,
    bm25Context: Bm25Context
  ): void {
    for (let i = 0; i < evaluations.length; i++) {
      const eval_ = evaluations[i];
      for (const termText of eval_.termTexts) {
        const record = this.termCache.get(termText);
        if (!record) continue;
        const postings = eval_.postingsByTermId.get(record.id) ?? [];

        for (const posting of postings) {
          const fileRecord = getFileById(posting.fileId);
          if (!fileRecord) continue;

          const data = fileMatches.get(posting.fileId);
          const bm25 = computeBm25Score(
            posting,
            fileRecord.doc_length,
            record.document_frequency,
            bm25Context
          );

          if (data) {
            data.bm25Score += bm25;
            data.matchedTerms.add(termText);
            data.matchedQueryTerms.add(i);
          } else {
            fileMatches.set(posting.fileId, {
              bm25Score: bm25,
              matchedTerms: new Set([termText]),
              matchedQueryTerms: new Set([i]),
              phrasePositions: [],
            });
          }
        }
      }
    }
  }

  private evaluateNode(
    node: QueryNode,
    file: FileRecord,
    fileMatches: Map<number, FileMatchData>,
    phraseEvaluations: PhraseEvaluation[]
  ): boolean {
    switch (node.type) {
      case 'term': {
        const matchData = fileMatches.get(file.id);
        if (!matchData) return false;
        // A term matches if any of its expanded forms matched this file.
        return matchData.matchedQueryTerms.size > 0;
      }
      case 'phrase': {
        const phraseEval = phraseEvaluations.find((p) => p.node === node);
        if (!phraseEval) return false;
        return (phraseEval.positionsByFile.get(file.id)?.length ?? 0) > 0;
      }
      case 'filter': {
        return evaluateFilter(file, node);
      }
      case 'and': {
        return (
          this.evaluateNode(node.left, file, fileMatches, phraseEvaluations) &&
          this.evaluateNode(node.right, file, fileMatches, phraseEvaluations)
        );
      }
      case 'or': {
        return (
          this.evaluateNode(node.left, file, fileMatches, phraseEvaluations) ||
          this.evaluateNode(node.right, file, fileMatches, phraseEvaluations)
        );
      }
      case 'not': {
        return !this.evaluateNode(node.child, file, fileMatches, phraseEvaluations);
      }
    }
  }

  private buildCandidates(
    fileIds: number[],
    fileMatches: Map<number, FileMatchData>,
    phraseEvaluations: PhraseEvaluation[]
  ): CandidateResult[] {
    return fileIds
      .map((fileId) => {
        const file = getFileById(fileId);
        const data = fileMatches.get(fileId);
        if (!file || !data) return null;

        const phrasePositions = this.collectPhrasePositions(
          fileId,
          phraseEvaluations
        );

        return {
          file,
          filename: path.basename(file.path),
          bm25Score: data.bm25Score,
          matchedTerms: data.matchedTerms,
          phrasePositions,
          matchedQueryTermCount: data.matchedQueryTerms.size,
        };
      })
      .filter((c): c is CandidateResult => c !== null);
  }

  private collectPhrasePositions(
    fileId: number,
    phraseEvaluations: PhraseEvaluation[]
  ): number[] {
    const positions: number[] = [];
    for (const eval_ of phraseEvaluations) {
      const filePositions = eval_.positionsByFile.get(fileId);
      if (filePositions) {
        positions.push(...filePositions);
      }
    }
    return positions;
  }

  private collectPhraseTerms(
    candidate: CandidateResult,
    phraseEvaluations: PhraseEvaluation[]
  ): string[] {
    const terms: string[] = [];
    for (const eval_ of phraseEvaluations) {
      if (eval_.positionsByFile.has(candidate.file.id)) {
        terms.push(...eval_.terms);
      }
    }
    return [...new Set(terms)];
  }

  private async buildResults(
    candidates: CandidateResult[],
    phraseEvaluations: PhraseEvaluation[]
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    for (const candidate of candidates) {
      const snippets = await generateSnippets(
        candidate.file.path,
        Array.from(candidate.matchedTerms),
        candidate.phrasePositions.length > 0 ? candidate.phrasePositions : undefined
      );

      results.push({
        fileId: candidate.file.id,
        path: candidate.file.path,
        filename: candidate.filename,
        size: candidate.file.size,
        modifiedTime: candidate.file.modified_time,
        score: 0, // Score is internal to ranking pipeline now.
        snippets: snippets.map((s) => s.text),
        matchedTerms: Array.from(candidate.matchedTerms),
        phraseTerms: this.collectPhraseTerms(candidate, phraseEvaluations),
        phraseMatch: candidate.phrasePositions.length > 0,
      });
    }
    return results;
  }

  private expandTerm(queryTerm: string): { terms: string[]; termIds: number[] } {
    const terms: string[] = [];
    const termIds: number[] = [];

    const exact = this.termCache.get(queryTerm);
    if (exact) {
      terms.push(queryTerm);
      termIds.push(exact.id);
    }

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
}

export const searchEngine = new SearchEngine();
