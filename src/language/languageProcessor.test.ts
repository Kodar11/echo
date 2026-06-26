import { describe, expect, it } from 'vitest';
import { processDocument, processQuery } from './languageProcessor.js';

describe('processDocument', () => {
  it('tokenizes and records positions', () => {
    const doc = processDocument('Hello world, hello again.');
    expect(doc.tokens).toEqual(['hello', 'world', 'hello', 'again']);
    expect(doc.positions.get('hello')).toEqual([0, 2]);
    expect(doc.language).toBeNull();
  });

  it('normalizes unicode', () => {
    const doc = processDocument('Café résumé');
    expect(doc.tokens).toEqual(['cafe', 'resume']);
  });

  it('detects language when enabled', () => {
    const doc = processDocument(
      'The quick brown fox jumps over the lazy dog.',
      { detectLanguage: true }
    );
    expect(doc.language).toBe('eng');
  });

  it('removes stop words when enabled', () => {
    const doc = processDocument('The quick brown fox', {
      detectLanguage: true,
      removeStopWords: true,
    });
    expect(doc.tokens).toEqual(['quick', 'brown', 'fox']);
  });
});

describe('processQuery', () => {
  it('tokenizes queries', () => {
    expect(processQuery('Quick Brown Fox')).toEqual(['quick', 'brown', 'fox']);
  });

  it('normalizes query terms', () => {
    expect(processQuery('Café')).toEqual(['cafe']);
  });
});
