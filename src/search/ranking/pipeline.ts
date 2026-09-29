import type {
  CandidateResult,
  RankedCandidate,
  RankingContext,
  RankingSignal,
} from './types.js';
import { DEFAULT_RANKING_WEIGHTS, type RankingWeights } from './types.js';
import { Bm25Signal } from './signals/bm25Signal.js';
import { PhraseSignal } from './signals/phraseSignal.js';
import { FilenameSignal } from './signals/filenameSignal.js';
import { FolderPrioritySignal } from './signals/folderPrioritySignal.js';
import { RecencySignal } from './signals/recencySignal.js';

/**
 * final score = Σ signal(candidate) × weight
 *
 * Ordering is deterministic: score descending, then most recently modified,
 * then path.
 */
export class RankingPipeline {
  private signals: { signal: RankingSignal; weight: number }[] = [];

  constructor(weights: RankingWeights = DEFAULT_RANKING_WEIGHTS) {
    this.addSignal(new PhraseSignal(), weights.phraseBoost);
    this.addSignal(new FilenameSignal(), weights.filenameBoost);
    this.addSignal(new Bm25Signal(), weights.bm25Boost);
    this.addSignal(new FolderPrioritySignal(), weights.folderBoost);
    this.addSignal(new RecencySignal(), weights.recencyBoost);
  }

  addSignal(signal: RankingSignal, weight: number): void {
    this.signals.push({ signal, weight });
  }

  score(candidate: CandidateResult, context: RankingContext): number {
    let score = 0;
    for (const { signal, weight } of this.signals) {
      score += signal.score(candidate, context) * weight;
    }
    return score;
  }

  rank(candidates: CandidateResult[], context: RankingContext): RankedCandidate[] {
    return candidates
      .map((candidate) => ({ candidate, score: this.score(candidate, context) }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.candidate.file.modified_time - a.candidate.file.modified_time ||
          (a.candidate.file.path < b.candidate.file.path ? -1 : a.candidate.file.path > b.candidate.file.path ? 1 : 0)
      );
  }
}
