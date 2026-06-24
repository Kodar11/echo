import { describe, expect, it } from 'vitest';
import { findFuzzyMatches, levenshteinDistance } from './fuzzySearch.js';

describe('levenshteinDistance', () => {
  it('computes edit distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
    expect(levenshteinDistance('cat', 'cut')).toBe(1);
  });
});

describe('findFuzzyMatches', () => {
  it('finds terms within max distance', () => {
    const candidates = ['cat', 'cut', 'cats', 'dog'];
    expect(findFuzzyMatches('cat', candidates, 1).sort()).toEqual([
      'cat',
      'cats',
      'cut',
    ]);
  });
});
