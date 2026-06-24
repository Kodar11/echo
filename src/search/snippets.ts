import { getExtractor } from '../file-extractors/registry.js';
import { tokenize } from '../indexer/tokenizer.js';

const SNIPPET_LENGTH = 160;
const CONTEXT_RADIUS = 60;

export async function generateSnippet(
  filePath: string,
  matchedTerms: string[],
  phraseMatchPositions?: number[]
): Promise<string> {
  const extractor = getExtractor(filePath);
  if (!extractor) return '';

  let text: string;
  try {
    text = await extractor.extract(filePath);
  } catch {
    return '';
  }

  if (!text) return '';

  const { tokens } = tokenize(text);
  if (tokens.length === 0) return text.slice(0, SNIPPET_LENGTH);

  // Find best token position to center snippet around
  let bestTokenIndex = -1;

  if (phraseMatchPositions && phraseMatchPositions.length > 0) {
    bestTokenIndex = phraseMatchPositions[0];
  } else {
    for (let i = 0; i < tokens.length; i++) {
      if (matchedTerms.includes(tokens[i])) {
        bestTokenIndex = i;
        break;
      }
    }
  }

  if (bestTokenIndex === -1) {
    return text.slice(0, SNIPPET_LENGTH);
  }

  // Map token index back to character position
  const token = tokens[bestTokenIndex];
  const charIndex = text.toLowerCase().indexOf(token);
  if (charIndex === -1) {
    return text.slice(0, SNIPPET_LENGTH);
  }

  const start = Math.max(0, charIndex - CONTEXT_RADIUS);
  const end = Math.min(text.length, charIndex + CONTEXT_RADIUS);
  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();

  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';

  return snippet;
}

export function highlightSnippet(snippet: string, terms: string[]): string {
  let highlighted = snippet;
  const escapedTerms = terms
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (escapedTerms.length === 0) return snippet;

  const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  highlighted = highlighted.replace(pattern, '<mark>$1</mark>');
  return highlighted;
}
