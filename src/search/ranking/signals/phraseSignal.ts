import type { CandidateResult, RankingSignal } from '../types.js';

/** Number of phrase occurrences, capped so long documents do not dominate. */
const MAX_COUNTED_OCCURRENCES = 5;

export class PhraseSignal implements RankingSignal {
  name = 'phrase';

  score(candidate: CandidateResult): number {
    return Math.min(candidate.phrasePositions.length, MAX_COUNTED_OCCURRENCES);
  }
}
