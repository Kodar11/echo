import type { CandidateResult, RankingContext, RankingSignal } from '../types.js';

export class FilenameSignal implements RankingSignal {
  name = 'filename';

  score(candidate: CandidateResult): number {
    const filename = candidate.filename.toLowerCase();
    let score = 0;

    for (const term of candidate.matchedTerms) {
      if (filename === term) {
        score += 3;
      } else if (filename.startsWith(term + '.')) {
        score += 2;
      } else if (filename.includes(term)) {
        score += 1;
      }
    }

    return score;
  }
}
