import { tokenizeText } from '../../../language/languageProcessor.js';
import type { CandidateResult, RankingSignal } from '../types.js';

/**
 * Boost for query words that appear in the file name (it does not make a file
 * match; matching is decided by content and filters). Per word: the whole
 * name (without extension) = 3, a name token = 2, a name token prefix = 1.
 */
export class FilenameSignal implements RankingSignal {
  name = 'filename';

  score(candidate: CandidateResult): number {
    const dot = candidate.filename.lastIndexOf('.');
    const stem = dot > 0 ? candidate.filename.slice(0, dot) : candidate.filename;
    const nameTokens = tokenizeText(stem);
    const whole = nameTokens.join(' ');

    let score = 0;
    for (const term of new Set(candidate.queryTerms)) {
      if (whole === term) score += 3;
      else if (nameTokens.includes(term)) score += 2;
      else if (nameTokens.some((token) => token.startsWith(term))) score += 1;
    }
    return score;
  }
}
