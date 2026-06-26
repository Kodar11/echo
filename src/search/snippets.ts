import { extractorManager } from '../services/extractors/ExtractorManager.js';
import { normalizeText } from '../language/normalize.js';

const MAX_SNIPPETS = 3;
const SNIPPET_WINDOW = 80;
const MERGE_DISTANCE = 200;

export interface Snippet {
  text: string;
  start: number;
  end: number;
}

export async function generateSnippets(
  filePath: string,
  matchedTerms: string[],
  phraseMatchPositions?: number[]
): Promise<Snippet[]> {
  const extractor = extractorManager.getExtractor(filePath);
  if (!extractor) return [];

  let text: string;
  try {
    const extracted = await extractor.extract(filePath);
    text = extracted.text;
  } catch {
    return [];
  }

  if (!text) return [];

  const normalizedTerms = matchedTerms.map((t) => normalizeText(t));
  const positions = findMatchPositions(text, normalizedTerms, phraseMatchPositions);

  if (positions.length === 0) {
    return [truncateSnippet(text, 0, SNIPPET_WINDOW * 2)];
  }

  const clusters = clusterPositions(positions);
  const snippets: Snippet[] = [];

  for (const cluster of clusters.slice(0, MAX_SNIPPETS)) {
    const center = cluster[Math.floor(cluster.length / 2)];
    const start = Math.max(0, center - SNIPPET_WINDOW);
    const end = Math.min(text.length, center + SNIPPET_WINDOW);
    snippets.push(createSnippet(text, start, end));
  }

  return snippets;
}

function findMatchPositions(
  text: string,
  matchedTerms: string[],
  phraseMatchPositions?: number[]
): number[] {
  const positions: number[] = [];
  const tokenPositions = getTokenPositions(text);

  // Add positions for individual matched terms.
  for (const { token, start } of tokenPositions) {
    if (matchedTerms.includes(token)) {
      positions.push(start);
    }
  }

  // Add positions for phrase matches.
  if (phraseMatchPositions && phraseMatchPositions.length > 0) {
    for (const tokenIndex of phraseMatchPositions) {
      const tokenPos = tokenPositions[tokenIndex];
      if (tokenPos) {
        positions.push(tokenPos.start);
      }
    }
  }

  return [...new Set(positions)].sort((a, b) => a - b);
}

function getTokenPositions(text: string): { token: string; start: number }[] {
  const regex = /[\p{L}\p{N}\p{M}]+/gu;
  const positions: { token: string; start: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    positions.push({ token: normalizeText(match[0]), start: match.index });
  }
  return positions;
}

function clusterPositions(positions: number[]): number[][] {
  if (positions.length === 0) return [];

  const clusters: number[][] = [[positions[0]]];
  for (let i = 1; i < positions.length; i++) {
    const current = positions[i];
    const lastCluster = clusters[clusters.length - 1];
    if (current - lastCluster[lastCluster.length - 1] <= MERGE_DISTANCE) {
      lastCluster.push(current);
    } else {
      clusters.push([current]);
    }
  }

  return clusters;
}

function createSnippet(text: string, start: number, end: number): Snippet {
  // Expand to word boundaries.
  let adjustedStart = start;
  let adjustedEnd = end;

  while (adjustedStart > 0 && /\S/.test(text[adjustedStart - 1])) {
    adjustedStart--;
  }
  while (adjustedEnd < text.length && /\S/.test(text[adjustedEnd])) {
    adjustedEnd++;
  }

  let snippetText = text.slice(adjustedStart, adjustedEnd).replace(/\s+/g, ' ').trim();

  if (adjustedStart > 0) snippetText = '…' + snippetText;
  if (adjustedEnd < text.length) snippetText = snippetText + '…';

  return { text: snippetText, start: adjustedStart, end: adjustedEnd };
}

function truncateSnippet(text: string, start: number, length: number): Snippet {
  return createSnippet(text, start, Math.min(text.length, start + length));
}
