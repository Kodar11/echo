import { describe, expect, it } from 'vitest';
import { computeBm25Score, computeIdf } from './bm25.js';
import type { Posting } from '../database/postings.js';

describe('computeIdf', () => {
  it('is higher for rare terms', () => {
    const rare = computeIdf(1, 100);
    const common = computeIdf(50, 100);
    expect(rare).toBeGreaterThan(common);
  });
});

describe('computeBm25Score', () => {
  it('scores documents with term frequency', () => {
    const posting: Posting = {
      termId: 1,
      fileId: 1,
      termFrequency: 3,
      positions: [0, 1, 2],
    };
    const score = computeBm25Score(posting, 100, 5, {
      totalDocs: 100,
      avgDocLength: 100,
    });
    expect(score).toBeGreaterThan(0);
  });
});
