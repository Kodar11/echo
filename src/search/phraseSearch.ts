import type { Posting } from '../database/postings.js';

/**
 * Phrase matching over original-token-stream positions (see the position
 * model in language/languageProcessor.ts).
 *
 * Phrase word i must occur at position `start + i`. A word that was not
 * indexed for a particular document — a stop word removed for that
 * document's language — is not required there; its slot matches any token.
 * So with stop-word removal on, "the machine learning" matches a document
 * containing "the machine learning", and "machine learning" never matches
 * "machine the learning".
 */

/** fileId -> sorted positions of a term in that file. */
export type PositionsByFile = Map<number, number[]>;

export interface PhraseMatchInput {
  terms: string[];
  /** Postings for a phrase word, or null if the word is not in the index. */
  positionsFor: (term: string) => PositionsByFile | null;
  /** Whether `term` is expected to be indexed in `fileId`. */
  isRequired?: (fileId: number, term: string) => boolean;
  /** Restricts matching to these files. */
  candidates?: Iterable<number>;
}

/** Returns fileId -> start positions of every occurrence of the phrase. */
export function matchPhrase(input: PhraseMatchInput): Map<number, number[]> {
  const { terms, positionsFor, isRequired = () => true } = input;
  const result = new Map<number, number[]>();
  if (terms.length === 0) return result;

  const slots = terms.map((term, offset) => ({ term, offset, postings: positionsFor(term) }));

  let fileIds: Iterable<number>;
  if (input.candidates) {
    fileIds = input.candidates;
  } else {
    const union = new Set<number>();
    for (const slot of slots) {
      if (slot.postings) for (const fileId of slot.postings.keys()) union.add(fileId);
    }
    fileIds = union;
  }

  for (const fileId of fileIds) {
    const required: { offset: number; positions: number[] }[] = [];
    let possible = true;
    for (const slot of slots) {
      if (!isRequired(fileId, slot.term)) continue;
      const positions = slot.postings?.get(fileId);
      if (!positions || positions.length === 0) {
        possible = false;
        break;
      }
      required.push({ offset: slot.offset, positions });
    }
    // A phrase made only of words the document did not index cannot be verified.
    if (!possible || required.length === 0) continue;

    let anchor = required[0];
    for (const slot of required) {
      if (slot.positions.length < anchor.positions.length) anchor = slot;
    }

    const starts: number[] = [];
    for (const position of anchor.positions) {
      const start = position - anchor.offset;
      if (start < 0) continue;
      if (required.every((slot) => slot === anchor || binaryIncludes(slot.positions, start + slot.offset))) {
        starts.push(start);
      }
    }
    if (starts.length > 0) {
      result.set(fileId, starts.sort((a, b) => a - b));
    }
  }

  return result;
}

/**
 * Consecutive-position matching for postings lists where every word is
 * required (one list of postings per phrase word, in phrase order).
 */
export function findPhraseMatches(postingsPerTerm: Posting[][]): Map<number, number[]> {
  const maps = postingsPerTerm.map((postings) => {
    const map: PositionsByFile = new Map();
    for (const posting of postings) {
      map.set(posting.fileId, [...(map.get(posting.fileId) ?? []), ...posting.positions].sort((a, b) => a - b));
    }
    return map;
  });
  const keys = maps.map((_, i) => `#${i}`);
  return matchPhrase({ terms: keys, positionsFor: (key) => maps[Number(key.slice(1))] ?? null });
}

function binaryIncludes(sorted: number[], value: number): boolean {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = sorted[mid];
    if (v === value) return true;
    if (v < value) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}
