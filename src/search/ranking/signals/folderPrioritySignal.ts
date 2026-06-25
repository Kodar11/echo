import type { CandidateResult, RankingContext, RankingSignal } from '../types.js';

export class FolderPrioritySignal implements RankingSignal {
  name = 'folder';

  score(candidate: CandidateResult): number {
    const path = candidate.file.path.toLowerCase();
    const homeMarkers = ['documents', 'desktop', 'downloads', 'projects'];
    if (homeMarkers.some((marker) => path.includes(marker))) {
      return 1;
    }
    return 0;
  }
}
