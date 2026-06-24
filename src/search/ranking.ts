const PHRASE_MATCH_BONUS = 1000;
const MATCHED_TERM_BONUS = 10;

export function computeCompositeScore(
  bm25Score: number,
  matchedTermCount: number,
  phraseMatchCount: number
): number {
  return (
    bm25Score +
    matchedTermCount * MATCHED_TERM_BONUS +
    phraseMatchCount * PHRASE_MATCH_BONUS
  );
}
