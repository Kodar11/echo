import { describe, expect, it } from 'vitest';
import { findPhraseMatches, matchPhrase } from './phraseSearch.js';
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

  it('treats words not indexed for a document as wildcards at their offset', () => {
    // Document tokens: 0 "the" (removed), 1 "machine", 2 "learning"
    const index: Record<string, Map<number, number[]>> = {
      machine: new Map([[1, [1]]]),
      learning: new Map([[1, [2]]]),
    };
    const run = (terms: string[]) =>
      matchPhrase({
        terms,
        positionsFor: (t) => index[t] ?? null,
        isRequired: (_file, t) => t !== 'the',
      });

    expect(run(['the', 'machine', 'learning']).get(1)).toEqual([0]);
    expect(run(['machine', 'learning']).get(1)).toEqual([1]);
    expect(run(['machine', 'the', 'learning']).has(1)).toBe(false);
    expect(run(['the']).has(1)).toBe(false);
  });

  it('requires every indexed word at its exact offset', () => {
    const index: Record<string, Map<number, number[]>> = {
      a: new Map([[1, [0, 10]]]),
      b: new Map([[1, [1, 5]]]),
    };
    const matches = matchPhrase({ terms: ['a', 'b'], positionsFor: (t) => index[t] ?? null });
    expect(matches.get(1)).toEqual([0]);
    expect(matchPhrase({ terms: ['a', 'missing'], positionsFor: (t) => index[t] ?? null }).size).toBe(0);
  });

  it('returns empty map for single term', () => {
    const postings: Posting[][] = [[makePosting(1, [0, 1])]];
    const matches = findPhraseMatches(postings);
    expect(matches.get(1)).toEqual([0, 1]);
  });
});
