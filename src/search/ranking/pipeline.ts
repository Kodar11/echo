import type { CandidateResult, RankingContext, RankingSignal } from './types.js';
import { DEFAULT_RANKING_WEIGHTS, type RankingWeights } from './types.js';
import { Bm25Signal } from './signals/bm25Signal.js';
import { PhraseSignal } from './signals/phraseSignal.js';
import { FilenameSignal } from './signals/filenameSignal.js';
import { FolderPrioritySignal } from './signals/folderPrioritySignal.js';
import { RecencySignal } from './signals/recencySignal.js';

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

  rank(candidates: CandidateResult[], context: RankingContext): CandidateResult[] {
    const scored = candidates.map((candidate) => {
      let score = 0;
      for (const { signal, weight } of this.signals) {
        score += signal.score(candidate, context) * weight;
      }
      return { candidate, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.candidate);
  }
}
