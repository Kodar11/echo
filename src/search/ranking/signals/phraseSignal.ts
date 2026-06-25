import type { CandidateResult, RankingContext, RankingSignal } from '../types.js';

export class PhraseSignal implements RankingSignal {
  name = 'phrase';

  score(candidate: CandidateResult): number {
    return candidate.phrasePositions.length;
  }
}
