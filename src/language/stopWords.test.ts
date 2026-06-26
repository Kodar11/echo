import { describe, expect, it } from 'vitest';
import { isStopWord } from './stopWords.js';

describe('isStopWord', () => {
  it('detects English stop words', () => {
    expect(isStopWord('the', 'eng')).toBe(true);
    expect(isStopWord('hello', 'eng')).toBe(false);
  });

  it('detects Hindi stop words', () => {
    expect(isStopWord('और', 'hin')).toBe(true);
    expect(isStopWord('किताब', 'hin')).toBe(false);
  });

  it('detects Marathi stop words', () => {
    expect(isStopWord('आणि', 'mar')).toBe(true);
    expect(isStopWord('पुस्तक', 'mar')).toBe(false);
  });

  it('returns false for unknown language', () => {
    expect(isStopWord('the', null)).toBe(false);
  });
});
