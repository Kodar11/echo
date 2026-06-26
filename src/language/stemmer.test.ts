import { describe, expect, it } from 'vitest';
import { stemTerm, supportsStemming } from './stemmer.js';

describe('stemTerm', () => {
  it('stems English words', () => {
    expect(stemTerm('running', 'eng')).toBe('run');
    expect(stemTerm('flies', 'eng')).toBe('fli');
    expect(stemTerm('connection', 'eng')).toBe('connect');
  });

  it('returns the original term when no stemmer is available', () => {
    expect(stemTerm('नमस्ते', 'hin')).toBe('नमस्ते');
  });
});

describe('supportsStemming', () => {
  it('returns true for English', () => {
    expect(supportsStemming('eng')).toBe(true);
  });

  it('returns false for unsupported languages', () => {
    expect(supportsStemming('hin')).toBe(false);
    expect(supportsStemming(null)).toBe(false);
  });
});
