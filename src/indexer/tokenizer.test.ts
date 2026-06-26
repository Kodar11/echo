import { describe, expect, it } from 'vitest';
import { tokenize, tokenizeQuery } from './tokenizer.js';

describe('tokenize', () => {
  it('splits text into tokens and positions', () => {
    const doc = tokenize('Hello world, hello again.');
    expect(doc.tokens).toEqual(['hello', 'world', 'hello', 'again']);
    expect(doc.positions.get('hello')).toEqual([0, 2]);
    expect(doc.positions.get('world')).toEqual([1]);
    expect(doc.positions.get('again')).toEqual([3]);
    expect(doc.language).toBeNull();
  });

  it('ignores punctuation', () => {
    const doc = tokenize('Run-time: 100% fast!!!');
    expect(doc.tokens).toEqual(['run', 'time', '100', 'fast']);
  });

  it('normalizes unicode and diacritics', () => {
    const doc = tokenize('Café résumé naïve');
    expect(doc.tokens).toEqual(['cafe', 'resume', 'naive']);
  });

  it('handles unicode letters and numbers', () => {
    const doc = tokenize('नमस्ते दुनिया १२३');
    expect(doc.tokens).toEqual(['नमस्ते', 'दुनिया', '१२३']);
  });

  it('detects language when enabled', () => {
    const doc = tokenize(
      'The quick brown fox jumps over the lazy dog.',
      { detectLanguage: true }
    );
    expect(doc.language).toBe('eng');
  });

  it('removes stop words when enabled', () => {
    const doc = tokenize('The quick brown fox', {
      detectLanguage: true,
      removeStopWords: true,
    });
    expect(doc.tokens).toEqual(['quick', 'brown', 'fox']);
    expect(doc.language).toBe('eng');
  });
});

describe('tokenizeQuery', () => {
  it('tokenizes a query string', () => {
    expect(tokenizeQuery('Quick Brown Fox')).toEqual([
      'quick',
      'brown',
      'fox',
    ]);
  });

  it('normalizes query terms', () => {
    expect(tokenizeQuery('Café')).toEqual(['cafe']);
  });
});
