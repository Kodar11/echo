import { describe, expect, it } from 'vitest';
import { tokenize, tokenizeQuery, tokenizeText, tokenizeWithOffsets } from './tokenizer.js';

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

describe('shared tokenization', () => {
  it('keeps original-stream positions when stop words are removed', () => {
    const doc = tokenize('The quick brown fox jumps over the lazy dog near the river bank today', {
      detectLanguage: true,
      removeStopWords: true,
    });
    expect(doc.language).toBe('eng');
    expect(doc.positions.has('the')).toBe(false);
    expect(doc.positions.get('quick')).toEqual([1]);
    expect(doc.positions.get('lazy')).toEqual([7]);
  });

  it('produces the same terms for composed and decomposed text', () => {
    expect(tokenizeText('café')).toEqual(tokenizeText('café'));
    expect(tokenizeText('CAFÉ')).toEqual(['cafe']);
  });

  it('maps tokens to character offsets for snippets', () => {
    const text = 'Hello, wörld!';
    const tokens = tokenizeWithOffsets(text);
    expect(tokens.map((t) => t.token)).toEqual(['hello', 'world']);
    expect(text.slice(tokens[1].start, tokens[1].end)).toBe('wörld');
  });

  it('splits compatibility characters exactly like the indexer', () => {
    expect(tokenizeText('½')).toEqual(['1', '2']);
    expect(tokenizeWithOffsets('½').map((t) => t.token)).toEqual(['1', '2']);
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
