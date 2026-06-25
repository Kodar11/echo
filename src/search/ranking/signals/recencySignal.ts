import type { CandidateResult, RankingContext, RankingSignal } from '../types.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

export class RecencySignal implements RankingSignal {
  name = 'recency';

  score(candidate: CandidateResult): number {
    const ageMs = Date.now() - candidate.file.modified_time;

    if (ageMs < ONE_DAY_MS) return 3;
    if (ageMs < ONE_WEEK_MS) return 2;
    if (ageMs < ONE_MONTH_MS) return 1;
    return 0;
  }
}
