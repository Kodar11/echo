import { Posting } from '../database/postings.js';

export function findPhraseMatches(
  postingsPerTerm: Posting[][]
): Map<number, number[]> {
  const result = new Map<number, number[]>();
  if (postingsPerTerm.length === 0) return result;

  // Build file_id -> positions array for each term
  const filePostings: Map<number, Posting[]>[] = postingsPerTerm.map(
    (postings) => {
      const map = new Map<number, Posting[]>();
      for (const posting of postings) {
        const list = map.get(posting.fileId);
        if (list) {
          list.push(posting);
        } else {
          map.set(posting.fileId, [posting]);
        }
      }
      return map;
    }
  );

  const firstTermFiles = filePostings[0].keys();
  for (const fileId of firstTermFiles) {
    const matchPositions: number[] = [];
    const firstPostings = filePostings[0].get(fileId) ?? [];

    for (const firstPosting of firstPostings) {
      outer: for (const startPos of firstPosting.positions) {
        // Check if consecutive positions exist for subsequent terms
        for (let termIndex = 1; termIndex < postingsPerTerm.length; termIndex++) {
          const termPostings = filePostings[termIndex].get(fileId) ?? [];
          const expectedPos = startPos + termIndex;
          const found = termPostings.some((p) =>
            p.positions.includes(expectedPos)
          );
          if (!found) continue outer;
        }
        matchPositions.push(startPos);
      }
    }

    if (matchPositions.length > 0) {
      result.set(fileId, matchPositions);
    }
  }

  return result;
}
