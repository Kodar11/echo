import { franc } from 'franc-min';

export type DetectedLanguage = 'eng' | 'hin' | 'mar' | null;

const SUPPORTED_LANGUAGES = new Set<string>(['eng', 'hin', 'mar']);

/**
 * Detect the language of a text sample.
 * Returns a supported ISO 639-3 code, or null if detection is disabled or
 * the detected language is not supported.
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.trim().length === 0) return null;

  const sample = text.slice(0, 5000);
  const detected = franc(sample);

  if (SUPPORTED_LANGUAGES.has(detected)) {
    return detected as DetectedLanguage;
  }

  return null;
}
