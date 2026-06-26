import { describe, expect, it } from 'vitest';
import { normalizeText } from './normalize.js';

describe('normalizeText', () => {
  it('lowercases text', () => {
    expect(normalizeText('Hello World')).toBe('hello world');
  });

  it('removes diacritics', () => {
    expect(normalizeText('café résumé naïve')).toBe('cafe resume naive');
  });

  it('keeps unicode scripts intact', () => {
    expect(normalizeText('नमस्ते दुनिया')).toBe('नमस्ते दुनिया');
  });
});
