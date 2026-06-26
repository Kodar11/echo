const DIACRITIC_RANGE = /[\u0300-\u036f]/g;

/**
 * Normalize text for indexing and search.
 *
 * 1. Decompose composed characters (NFKD).
 * 2. Strip combining diacritical marks.
 * 3. Lowercase.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(DIACRITIC_RANGE, '')
    .toLowerCase()
    .trim();
}
