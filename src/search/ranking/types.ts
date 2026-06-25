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
  bm25Score: number;
  matchedTerms: Set<string>;
  phrasePositions: number[];
  matchedQueryTermCount: number;
}

export interface RankingSignal {
  name: string;
  score(candidate: CandidateResult, context: RankingContext): number;
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
