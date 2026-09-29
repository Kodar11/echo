import type { FileRecord } from '../../database/files.js';
import type { QueryNode } from '../queryParser.js';

export interface RankingContext {
  query: string;
  queryNode: QueryNode | null;
  phraseTerms: string[][];
  bm25Context: {
    totalDocs: number;
    avgDocLength: number;
  };
}

export interface CandidateResult {
  file: FileRecord;
  filename: string;
  /** Content relevance: BM25 summed over matched positive query terms. */
  bm25Score: number;
  /** Index terms (after expansion) that matched in this file's content. */
  matchedTerms: Set<string>;
  /** The user's positive query words (terms and phrase words). */
  queryTerms: string[];
  /** Start positions of positive phrase matches. */
  phrasePositions: number[];
  /** How many distinct positive term clauses matched this file. */
  matchedQueryTermCount: number;
}

export interface RankingSignal {
  name: string;
  score(candidate: CandidateResult, context: RankingContext): number;
}

export interface RankedCandidate {
  candidate: CandidateResult;
  score: number;
}

export interface RankingWeights {
  phraseBoost: number;
  filenameBoost: number;
  bm25Boost: number;
  folderBoost: number;
  recencyBoost: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  phraseBoost: 1000,
  filenameBoost: 80,
  bm25Boost: 1,
  folderBoost: 10,
  recencyBoost: 5,
};
