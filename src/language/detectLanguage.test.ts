import { describe, expect, it } from 'vitest';
import { detectLanguage } from './detectLanguage.js';

describe('detectLanguage', () => {
  it('detects English', () => {
    expect(
      detectLanguage(
        'The quick brown fox jumps over the lazy dog.'
      )
    ).toBe('eng');
  });

  it('detects Hindi', () => {
    expect(
      detectLanguage(
        'हिंदी भाषा भारत की सबसे अधिक बोली जाने वाली भाषा है। यह देवनागरी लिपि में लिखी जाती है।'
      )
    ).toBe('hin');
  });

  it('detects Marathi', () => {
    expect(
      detectLanguage(
        'मराठी भाषा महाराष्ट्रातील प्रमुख भाषा आहे. ही भाषा देवनागरी लिपीत लिहिली जाते.'
      )
    ).toBe('mar');
  });

  it('returns null for empty text', () => {
    expect(detectLanguage('')).toBeNull();
  });
});
