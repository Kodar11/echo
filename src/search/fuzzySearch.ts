export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

export function findFuzzyMatches(
  query: string,
  candidates: string[],
  maxDistance: number
): string[] {
  const matches: string[] = [];
  for (const candidate of candidates) {
    if (Math.abs(candidate.length - query.length) > maxDistance) continue;
    if (levenshteinDistance(query, candidate) <= maxDistance) {
      matches.push(candidate);
    }
  }
  return matches;
}
