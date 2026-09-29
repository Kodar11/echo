import path from 'path';
import type { FileRecord } from '../database/files.js';
import { getAllFiles } from '../database/files.js';
import { getFolders } from '../database/folders.js';
import type { Posting } from '../database/postings.js';
import { getPostingsForTerm } from '../database/postings.js';
import { getBooleanSetting } from '../database/settings.js';
import { getAllTerms, getTermIdsForLanguage, type TermRecord } from '../database/terms.js';
import { isPathInside } from '../indexer/paths.js';
import { STEMMING_LANGUAGES, stemTerm } from '../language/stemmer.js';
import { isStopWord } from '../language/stopWords.js';
import { SETTING_KEYS } from '../settings/keys.js';
import { computeBm25Score, type Bm25Context } from './bm25.js';
import { compileFilter, FilterError, FILTER_KEYS, type FilterPredicate } from './filters.js';
import { withinEditDistance } from './fuzzySearch.js';
import { matchPhrase, type PositionsByFile } from './phraseSearch.js';
import { parseQuery, type QueryError, type QueryNode } from './queryParser.js';
import { RankingPipeline } from './ranking/pipeline.js';
import type { CandidateResult, RankingContext } from './ranking/types.js';
import { generateSnippets, type PhraseSpan } from './snippets.js';
import { Trie } from './trie.js';

const RESULT_LIMIT = 50;
/** Results that get snippets (extraction is the expensive part of a search). */
const SNIPPET_LIMIT = 20;
const SNIPPET_CONCURRENCY = 4;

/** Term expansion guardrails. */
const MIN_PREFIX_LENGTH = 3;
const MAX_PREFIX_EXPANSIONS = 50;
const MIN_FUZZY_LENGTH = 4;
const FUZZY_MAX_DISTANCE = 1;
const MAX_FUZZY_EXPANSIONS = 10;

/**
 * Relative BM25 weight of each kind of expansion: the word the user typed
 * counts fully, looser matches progressively less.
 */
const EXPANSION_WEIGHTS = { exact: 1, stem: 0.8, prefix: 0.5, fuzzy: 0.3 } as const;
type ExpansionKind = keyof typeof EXPANSION_WEIGHTS;

export interface SearchOptions {
  query: string;
  folderIds?: number[];
  /** Echoed back so callers can discard stale responses. */
  requestId?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  durationMs: number;
  requestId?: number;
  /** Set when the query could not be parsed or has an invalid filter. */
  error?: QueryError;
  /** Set when a newer search superseded this one before it finished. */
  cancelled?: boolean;
}

export interface SearchResult {
  fileId: number;
  path: string;
  filename: string;
  size: number;
  modifiedTime: number;
  score: number;
  snippets: string[];
  matchedTerms: string[];
  phraseTerms: string[];
  phraseMatch: boolean;
}

export type IsCancelled = () => boolean;

interface Expansion {
  term: TermRecord;
  kind: ExpansionKind;
  /** Stem expansions only match documents of the stemmer's language. */
  language?: string;
}

/** A query tree with filters validated and compiled. */
type CompiledNode =
  | { type: 'term'; value: string; index: number }
  | { type: 'phrase'; terms: string[]; index: number }
  | { type: 'filter'; predicate: FilterPredicate }
  | { type: 'and'; left: CompiledNode; right: CompiledNode }
  | { type: 'or'; left: CompiledNode; right: CompiledNode }
  | { type: 'not'; child: CompiledNode };

interface EvaluationContext {
  universe: Set<number>;
  /** Positive (not negated) term / phrase leaves, used for scoring. */
  termLeaves: { value: string; index: number }[];
  phraseLeaves: { terms: string[]; index: number }[];
  postingsCache: Map<number, Posting[]>;
  expansionCache: Map<string, Expansion[]>;
  phraseMatches: Map<number, Map<number, number[]>>;
  removeStopWords: boolean;
}

const METADATA_FILTER_SUGGESTIONS = FILTER_KEYS.map((key) => `${key}:`);

/**
 * Query evaluation model:
 *
 *   1. parse the query into an AST (syntax errors are returned, not thrown);
 *   2. compile filters (invalid filters are returned as errors);
 *   3. the candidate universe is every indexed file in the search scope;
 *   4. each AST node evaluates to a subset of the universe:
 *        term    → files with a posting for one of its expansions
 *        phrase  → files where the words occur consecutively
 *        filter  → files whose metadata satisfies it
 *        AND/OR  → intersection / union,  NOT → universe minus child;
 *   5. matching files are scored from their positive term/phrase leaves and
 *      ranked; the returned `score` is the ranking score;
 *   6. snippets are built for the top results only.
 */
export class SearchEngine {
  private trie = new Trie();
  private terms = new Map<string, TermRecord>();
  private termsByLength = new Map<number, string[]>();
  private files = new Map<number, FileRecord>();
  private totalDocLength = 0;
  /** language -> stem -> terms occurring in documents of that language. */
  private stemTables = new Map<string, Map<string, Set<string>>>();
  private rankingPipeline = new RankingPipeline();

  /** Reloads the in-memory vocabulary and file table from the database. */
  rebuildIndex(): void {
    const terms = getAllTerms();
    const files = getAllFiles();

    this.trie.clear();
    this.terms.clear();
    this.termsByLength.clear();
    this.files.clear();
    this.stemTables.clear();
    this.totalDocLength = 0;

    const termsById = new Map<number, string>();
    for (const term of terms) {
      this.trie.insert(term.term);
      this.terms.set(term.term, term);
      termsById.set(term.id, term.term);
      const length = term.term.length;
      const bucket = this.termsByLength.get(length);
      if (bucket) bucket.push(term.term);
      else this.termsByLength.set(length, [term.term]);
    }

    for (const file of files) {
      this.files.set(file.id, file);
      this.totalDocLength += file.doc_length;
    }

    if (getBooleanSetting(SETTING_KEYS.enableStemming, false)) {
      // Stem only vocabulary from documents detected in that language, so
      // English rules are never applied to other languages.
      for (const language of STEMMING_LANGUAGES) {
        const table = new Map<string, Set<string>>();
        for (const termId of getTermIdsForLanguage(language)) {
          const term = termsById.get(termId);
          if (!term) continue;
          const stem = stemTerm(term, language);
          const set = table.get(stem);
          if (set) set.add(term);
          else table.set(stem, new Set([term]));
        }
        this.stemTables.set(language, table);
      }
    }
  }

  getSuggestions(prefix: string, limit = 10): string[] {
    const normalized = prefix.trim().toLowerCase();
    if (!normalized) return [];

    const filterSuggestions = METADATA_FILTER_SUGGESTIONS.filter((s) => s.startsWith(normalized));
    const termSuggestions = this.trie
      .find(normalized, 200)
      .sort(
        (a, b) =>
          (this.terms.get(b)?.document_frequency ?? 0) - (this.terms.get(a)?.document_frequency ?? 0) ||
          a.localeCompare(b)
      );
    return [...filterSuggestions, ...termSuggestions].slice(0, limit);
  }

  async search(options: SearchOptions, isCancelled: IsCancelled = () => false): Promise<SearchResponse> {
    const startTime = performance.now();
    const { query, folderIds, requestId } = options;
    const elapsed = () => Math.round(performance.now() - startTime);
    const empty = (extra: Partial<SearchResponse> = {}): SearchResponse => ({
      results: [],
      totalCount: 0,
      durationMs: elapsed(),
      requestId,
      ...extra,
    });

    const parsed = parseQuery(query);
    if (parsed.error) return empty({ error: parsed.error });
    if (!parsed.root) return empty();

    let compiled: CompiledNode;
    const leafCounter = { value: 0 };
    try {
      compiled = compile(parsed.root, leafCounter);
    } catch (err) {
      if (err instanceof FilterError) {
        return empty({ error: { kind: 'filter', message: err.message } });
      }
      throw err;
    }

    const universe = this.resolveScope(folderIds);
    if (universe.size === 0) return empty();

    const context: EvaluationContext = {
      universe,
      termLeaves: [],
      phraseLeaves: [],
      postingsCache: new Map(),
      expansionCache: new Map(),
      phraseMatches: new Map(),
      removeStopWords: getBooleanSetting(SETTING_KEYS.removeStopWords, false),
    };
    collectPositiveLeaves(compiled, false, context);

    const matched = this.evaluate(compiled, context);
    if (isCancelled()) return empty({ cancelled: true });
    if (matched.size === 0) return empty();

    const bm25Context: Bm25Context = {
      totalDocs: this.files.size,
      avgDocLength: this.files.size > 0 ? this.totalDocLength / this.files.size || 1 : 1,
    };
    const candidates = this.buildCandidates(matched, context, bm25Context);
    const rankingContext: RankingContext = {
      query,
      queryNode: parsed.root,
      phraseTerms: context.phraseLeaves.map((p) => p.terms),
      bm25Context,
    };
    const ranked = this.rankingPipeline.rank(candidates, rankingContext).slice(0, RESULT_LIMIT);

    const results: SearchResult[] = ranked.map(({ candidate, score }) => ({
      fileId: candidate.file.id,
      path: candidate.file.path,
      filename: candidate.filename,
      size: candidate.file.size,
      modifiedTime: candidate.file.modified_time,
      score,
      snippets: [],
      matchedTerms: Array.from(candidate.matchedTerms),
      phraseTerms: this.matchedPhraseTerms(candidate.file.id, context),
      phraseMatch: candidate.phrasePositions.length > 0,
    }));

    // Snippets: top results only, bounded concurrency, cancellable between files.
    const snippetTargets = ranked.slice(0, SNIPPET_LIMIT);
    for (let i = 0; i < snippetTargets.length; i += SNIPPET_CONCURRENCY) {
      if (isCancelled()) return empty({ cancelled: true });
      const batch = snippetTargets.slice(i, i + SNIPPET_CONCURRENCY);
      const snippetLists = await Promise.all(
        batch.map(({ candidate }) =>
          generateSnippets(
            candidate.file.path,
            [...candidate.matchedTerms, ...candidate.queryTerms],
            this.phraseSpans(candidate.file.id, context)
          ).catch(() => [])
        )
      );
      snippetLists.forEach((snippets, j) => {
        results[i + j].snippets = snippets.map((s) => s.text);
      });
    }
    if (isCancelled()) return empty({ cancelled: true });

    return { results, totalCount: matched.size, durationMs: elapsed(), requestId };
  }

  /** Files in the selected folders (path-boundary aware), or all files. */
  private resolveScope(folderIds?: number[]): Set<number> {
    const all = new Set(this.files.keys());
    if (!folderIds || folderIds.length === 0) return all;

    const roots = getFolders()
      .filter((folder) => folderIds.includes(folder.id))
      .map((folder) => folder.path);
    if (roots.length === 0) return all;

    const scoped = new Set<number>();
    for (const [id, file] of this.files) {
      if (roots.some((root) => isPathInside(file.path, root))) scoped.add(id);
    }
    return scoped;
  }

  private evaluate(node: CompiledNode, context: EvaluationContext): Set<number> {
    switch (node.type) {
      case 'term': {
        const result = new Set<number>();
        for (const expansion of this.expand(node.value, context)) {
          for (const posting of this.postings(expansion.term.id, context)) {
            if (context.universe.has(posting.fileId) && this.applies(expansion, posting.fileId)) {
              result.add(posting.fileId);
            }
          }
        }
        return result;
      }
      case 'phrase':
        return new Set(this.phraseMatchesFor(node, context).keys());
      case 'filter': {
        const result = new Set<number>();
        for (const id of context.universe) {
          const file = this.files.get(id);
          if (file && node.predicate(file)) result.add(id);
        }
        return result;
      }
      case 'and': {
        const left = this.evaluate(node.left, context);
        if (left.size === 0) return left;
        const right = this.evaluate(node.right, context);
        const [small, large] = left.size <= right.size ? [left, right] : [right, left];
        const result = new Set<number>();
        for (const id of small) if (large.has(id)) result.add(id);
        return result;
      }
      case 'or': {
        const result = this.evaluate(node.left, context);
        for (const id of this.evaluate(node.right, context)) result.add(id);
        return result;
      }
      case 'not': {
        const excluded = this.evaluate(node.child, context);
        const result = new Set<number>();
        for (const id of context.universe) if (!excluded.has(id)) result.add(id);
        return result;
      }
    }
  }

  private phraseMatchesFor(
    node: { terms: string[]; index: number },
    context: EvaluationContext
  ): Map<number, number[]> {
    const cached = context.phraseMatches.get(node.index);
    if (cached) return cached;

    const positionsFor = (term: string): PositionsByFile | null => {
      const record = this.terms.get(term);
      if (!record) return null;
      const map: PositionsByFile = new Map();
      for (const posting of this.postings(record.id, context)) {
        map.set(posting.fileId, posting.positions);
      }
      return map;
    };

    const matches = matchPhrase({
      terms: node.terms,
      positionsFor,
      isRequired: (fileId, term) =>
        !(context.removeStopWords && isStopWord(term, this.files.get(fileId)?.language ?? null)),
    });
    for (const fileId of matches.keys()) {
      if (!context.universe.has(fileId)) matches.delete(fileId);
    }
    context.phraseMatches.set(node.index, matches);
    return matches;
  }

  private postings(termId: number, context: EvaluationContext): Posting[] {
    let postings = context.postingsCache.get(termId);
    if (!postings) {
      postings = getPostingsForTerm(termId);
      context.postingsCache.set(termId, postings);
    }
    return postings;
  }

  /**
   * Index terms a query word stands for: the exact word, stems (if enabled),
   * prefixes (words of 3+ chars), and — only when nothing else matched —
   * fuzzy variants within edit distance 1, all capped.
   */
  private expand(queryTerm: string, context: EvaluationContext): Expansion[] {
    const cached = context.expansionCache.get(queryTerm);
    if (cached) return cached;

    const expansions = new Map<string, Expansion>();
    const add = (text: string, kind: ExpansionKind, language?: string) => {
      const term = this.terms.get(text);
      if (term && !expansions.has(text)) expansions.set(text, { term, kind, language });
    };

    add(queryTerm, 'exact');

    for (const [language, table] of this.stemTables) {
      for (const text of table.get(stemTerm(queryTerm, language)) ?? []) add(text, 'stem', language);
    }

    if (queryTerm.length >= MIN_PREFIX_LENGTH) {
      for (const text of this.trie.find(queryTerm, MAX_PREFIX_EXPANSIONS + 1)) add(text, 'prefix');
    }

    if (expansions.size === 0 && queryTerm.length >= MIN_FUZZY_LENGTH) {
      let found = 0;
      for (let length = queryTerm.length - FUZZY_MAX_DISTANCE; length <= queryTerm.length + FUZZY_MAX_DISTANCE; length++) {
        for (const text of this.termsByLength.get(length) ?? []) {
          if (found >= MAX_FUZZY_EXPANSIONS) break;
          if (withinEditDistance(queryTerm, text, FUZZY_MAX_DISTANCE)) {
            add(text, 'fuzzy');
            found++;
          }
        }
      }
    }

    const result = Array.from(expansions.values());
    context.expansionCache.set(queryTerm, result);
    return result;
  }

  private applies(expansion: Expansion, fileId: number): boolean {
    return !expansion.language || this.files.get(fileId)?.language === expansion.language;
  }

  private buildCandidates(
    matched: Set<number>,
    context: EvaluationContext,
    bm25Context: Bm25Context
  ): CandidateResult[] {
    const scores = new Map<number, { bm25: number; terms: Set<string>; clauses: Set<number> }>();
    const entryFor = (fileId: number) => {
      let entry = scores.get(fileId);
      if (!entry) {
        entry = { bm25: 0, terms: new Set(), clauses: new Set() };
        scores.set(fileId, entry);
      }
      return entry;
    };

    for (const leaf of context.termLeaves) {
      for (const expansion of this.expand(leaf.value, context)) {
        const { term, kind } = expansion;
        for (const posting of this.postings(term.id, context)) {
          if (!matched.has(posting.fileId) || !this.applies(expansion, posting.fileId)) continue;
          const file = this.files.get(posting.fileId);
          if (!file) continue;
          const entry = entryFor(posting.fileId);
          entry.bm25 +=
            EXPANSION_WEIGHTS[kind] *
            computeBm25Score(posting, file.doc_length, term.document_frequency, bm25Context);
          entry.terms.add(term.term);
          entry.clauses.add(leaf.index);
        }
      }
    }

    const queryTerms = [
      ...context.termLeaves.map((leaf) => leaf.value),
      ...context.phraseLeaves.flatMap((leaf) => leaf.terms),
    ];

    const candidates: CandidateResult[] = [];
    for (const fileId of matched) {
      const file = this.files.get(fileId);
      if (!file) continue;
      const entry = scores.get(fileId);
      const phrasePositions: number[] = [];
      for (const leaf of context.phraseLeaves) {
        phrasePositions.push(...(this.phraseMatchesFor(leaf, context).get(fileId) ?? []));
      }
      candidates.push({
        file,
        filename: path.basename(file.path),
        bm25Score: entry?.bm25 ?? 0,
        matchedTerms: entry?.terms ?? new Set(),
        queryTerms,
        phrasePositions,
        matchedQueryTermCount: entry?.clauses.size ?? 0,
      });
    }
    return candidates;
  }

  private matchedPhraseTerms(fileId: number, context: EvaluationContext): string[] {
    const terms = new Set<string>();
    for (const leaf of context.phraseLeaves) {
      if (this.phraseMatchesFor(leaf, context).has(fileId)) {
        for (const term of leaf.terms) terms.add(term);
      }
    }
    return Array.from(terms);
  }

  private phraseSpans(fileId: number, context: EvaluationContext): PhraseSpan[] {
    const spans: PhraseSpan[] = [];
    for (const leaf of context.phraseLeaves) {
      for (const start of this.phraseMatchesFor(leaf, context).get(fileId) ?? []) {
        spans.push({ start, length: leaf.terms.length });
      }
    }
    return spans;
  }
}

function compile(node: QueryNode, counter: { value: number }): CompiledNode {
  switch (node.type) {
    case 'term':
      return { type: 'term', value: node.value, index: counter.value++ };
    case 'phrase':
      return { type: 'phrase', terms: node.terms, index: counter.value++ };
    case 'filter':
      return { type: 'filter', predicate: compileFilter(node) };
    case 'and':
    case 'or':
      return { type: node.type, left: compile(node.left, counter), right: compile(node.right, counter) };
    case 'not':
      return { type: 'not', child: compile(node.child, counter) };
  }
}

/** Term/phrase leaves under an even number of NOTs contribute to relevance. */
function collectPositiveLeaves(node: CompiledNode, negated: boolean, context: EvaluationContext): void {
  switch (node.type) {
    case 'term':
      if (!negated) context.termLeaves.push({ value: node.value, index: node.index });
      return;
    case 'phrase':
      if (!negated) context.phraseLeaves.push({ terms: node.terms, index: node.index });
      return;
    case 'filter':
      return;
    case 'and':
    case 'or':
      collectPositiveLeaves(node.left, negated, context);
      collectPositiveLeaves(node.right, negated, context);
      return;
    case 'not':
      collectPositiveLeaves(node.child, !negated, context);
      return;
  }
}

export const searchEngine = new SearchEngine();
