import { detectLanguage, type DetectedLanguage } from './detectLanguage.js';
import { normalizeText } from './normalize.js';
import { isStopWord } from './stopWords.js';

/**
 * Tokenization shared by indexing, query parsing and snippet highlighting.
 *
 * Raw tokens are maximal runs of letters / numbers / combining marks in the
 * *original* text. Each raw token is normalized (NFKD, Latin diacritics
 * stripped, lowercased) and, if normalization introduced separators (e.g.
 * "½" -> "1⁄2"), split further. Because every consumer uses this function,
 * the same logical text always yields the same terms, and token indexes line
 * up with character offsets for snippets.
 *
 * Position model: a token's position is its index in this full token stream,
 * *including* stop words. When stop-word removal is enabled, stop words are
 * not stored, but the remaining tokens keep their original positions (gaps
 * remain). Phrase matching therefore compares positions in the original
 * stream and treats a phrase word that was removed from a document as a
 * wildcard at its offset (see search/phraseSearch.ts).
 */

const RAW_TOKEN = /[\p{L}\p{N}\p{M}]+/gu;
const SEPARATOR = /[^\p{L}\p{N}\p{M}]+/u;
const ASCII_ONLY = /^[\x00-\x7f]*$/;

export interface TokenWithOffset {
  token: string;
  /** Character offsets of the raw token in the original text. */
  start: number;
  end: number;
}

function normalizeRawToken(raw: string): string[] {
  if (ASCII_ONLY.test(raw)) return [raw.toLowerCase()];
  return normalizeText(raw).split(SEPARATOR).filter(Boolean);
}

export function tokenizeWithOffsets(text: string): TokenWithOffset[] {
  const result: TokenWithOffset[] = [];
  RAW_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RAW_TOKEN.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    for (const token of normalizeRawToken(match[0])) {
      result.push({ token, start, end });
    }
  }
  return result;
}

export function tokenizeText(text: string): string[] {
  const result: string[] = [];
  RAW_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RAW_TOKEN.exec(text)) !== null) {
    for (const token of normalizeRawToken(match[0])) {
      result.push(token);
    }
  }
  return result;
}

export interface LanguageProcessorOptions {
  detectLanguage?: boolean;
  removeStopWords?: boolean;
}

export interface ProcessedDocument {
  /** Indexed tokens in order (stop words excluded when removal is enabled). */
  tokens: string[];
  /** term -> positions in the full token stream (see position model above). */
  positions: Map<string, number[]>;
  language: DetectedLanguage;
}

const LANGUAGE_SAMPLE_CHARS = 5000;

export function processDocument(
  text: string,
  options: LanguageProcessorOptions = {}
): ProcessedDocument {
  const language = options.detectLanguage
    ? detectLanguage(text.slice(0, LANGUAGE_SAMPLE_CHARS))
    : null;

  const allTokens = tokenizeText(text);
  const tokens: string[] = [];
  const positions = new Map<string, number[]>();

  for (let i = 0; i < allTokens.length; i++) {
    const token = allTokens[i];
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
 * Tokenize a query string with exactly the indexing rules. Stop words are
 * kept; whether they can match depends on how each document was indexed.
 */
export function processQuery(text: string): string[] {
  return tokenizeText(text);
}

export { detectLanguage, normalizeText, isStopWord };
