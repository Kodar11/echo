import { detectLanguage, type DetectedLanguage } from './detectLanguage.js';
import { normalizeText } from './normalize.js';
import { isStopWord } from './stopWords.js';

const TOKEN_SEPARATOR = /[^\p{L}\p{N}\p{M}]+/gu;

export interface LanguageProcessorOptions {
  detectLanguage?: boolean;
  removeStopWords?: boolean;
}

export interface ProcessedDocument {
  tokens: string[];
  positions: Map<string, number[]>;
  language: DetectedLanguage;
}

/**
 * Process raw text into normalized tokens for indexing.
 *
 * Steps:
 * 1. Unicode normalization + lowercase.
 * 2. Language detection (optional).
 * 3. Tokenization on Unicode letters/numbers.
 * 4. Stop-word removal (optional, language-specific).
 */
export function processDocument(
  text: string,
  options: LanguageProcessorOptions = {}
): ProcessedDocument {
  const normalized = normalizeText(text);
  const language = options.detectLanguage
    ? detectLanguage(normalized)
    : null;

  const rawTokens = normalized.split(TOKEN_SEPARATOR).filter(Boolean);
  const tokens: string[] = [];
  const positions = new Map<string, number[]>();

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    if (options.removeStopWords && isStopWord(token, language)) {
      continue;
    }
    tokens.push(token);
    const list = positions.get(token);
    if (list) {
      list.push(i);
    } else {
      positions.set(token, [i]);
    }
  }

  return { tokens, positions, language };
}

/**
 * Tokenize a query string. Stop words are intentionally kept so users can
 * search for them if they choose to; the search engine controls expansion.
 */
export function processQuery(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized.split(TOKEN_SEPARATOR).filter(Boolean);
}

export { detectLanguage, normalizeText, isStopWord };
