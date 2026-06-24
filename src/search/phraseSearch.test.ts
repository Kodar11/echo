import { describe, expect, it } from 'vitest';
import { findPhraseMatches } from './phraseSearch.js';
import type { Posting } from '../database/postings.js';

function makePosting(fileId: number, positions: number[]): Posting {
  return {
    termId: 0,
    fileId,
    termFrequency: positions.length,
    positions,
  };
}

describe('findPhraseMatches', () => {
  it('finds consecutive positions for phrase', () => {
    const postings: Posting[][] = [
      [makePosting(1, [0, 5]), makePosting(2, [0])],
      [makePosting(1, [1, 6]), makePosting(2, [2])],
      [makePosting(1, [2, 7]), makePosting(2, [3])],
    ];

    const matches = findPhraseMatches(postings);
    expect(matches.get(1)).toEqual([0, 5]);
    expect(matches.get(2)).toBeUndefined();
  });

  it('returns empty map for single term', () => {
    const postings: Posting[][] = [[makePosting(1, [0, 1])]];
    const matches = findPhraseMatches(postings);
    expect(matches.get(1)).toEqual([0, 1]);
  });
});
