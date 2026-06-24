import { describe, expect, it } from 'vitest';
import { tokenize, tokenizeQuery } from './tokenizer.js';

describe('tokenize', () => {
  it('splits text into tokens and positions', () => {
    const doc = tokenize('Hello world, hello again.');
    expect(doc.tokens).toEqual([
      'hello',
      'world',
      'hello',
      'again',
    ]);
    expect(doc.positions.get('hello')).toEqual([0, 2]);
    expect(doc.positions.get('world')).toEqual([1]);
    expect(doc.positions.get('again')).toEqual([3]);
  });

  it('ignores punctuation', () => {
    const doc = tokenize('Run-time: 100% fast!!!');
    expect(doc.tokens).toEqual(['run', 'time', '100', 'fast']);
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
});
