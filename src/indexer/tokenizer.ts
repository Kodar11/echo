export interface TokenizedDocument {
  tokens: string[];
  positions: Map<string, number[]>;
}

export function tokenize(text: string): TokenizedDocument {
  const normalized = text.toLowerCase();
  const positions = new Map<string, number[]>();
  const tokens: string[] = [];

  // Split on non-alphanumeric characters, but keep internal apostrophes? No,
  // keep it simple: any non-alphanumeric sequence is a separator.
  const rawTokens = normalized.split(/[^a-z0-9]+/);

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    if (!token || token.length === 0) continue;
    tokens.push(token);
    const list = positions.get(token);
    if (list) {
      list.push(i);
    } else {
      positions.set(token, [i]);
    }
  }

  return { tokens, positions };
}

export function tokenizeQuery(text: string): string[] {
  const normalized = text.toLowerCase();
  return normalized
    .split(/[^a-z0-9]+/)
    .filter((t) => t && t.length > 0);
}
