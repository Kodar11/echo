import type { CandidateResult, RankingContext, RankingSignal } from '../types.js';

export class Bm25Signal implements RankingSignal {
  name = 'bm25';

  score(candidate: CandidateResult): number {
    return candidate.bm25Score;
  }
}
