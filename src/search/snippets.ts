import fs from 'fs/promises';
import { extractorManager } from '../services/extractors/ExtractorManager.js';
import { tokenizeWithOffsets } from '../language/languageProcessor.js';

const MAX_SNIPPETS = 3;
const SNIPPET_WINDOW = 80;
const MERGE_DISTANCE = 200;
/** Only this much of a document is scanned for snippet positions. */
const MAX_SCAN_CHARS = 2_000_000;
/** Total characters of extracted text kept in memory across files. */
const CACHE_BUDGET_CHARS = 20_000_000;

export interface Snippet {
  text: string;
  start: number;
  end: number;
}

interface CachedText {
  key: string;
  text: string;
}

/**
 * Small LRU of extracted document text, keyed by path + size + mtime so a
 * changed file is never served stale text. Avoids re-running extractors
 * (notably PDF parsing) for every keystroke of a live search.
 */
class TextCache {
  private entries = new Map<string, CachedText>();
  private size = 0;

  get(filePath: string, key: string): string | undefined {
    const entry = this.entries.get(filePath);
    if (!entry || entry.key !== key) return undefined;
    this.entries.delete(filePath);
    this.entries.set(filePath, entry);
    return entry.text;
  }

  set(filePath: string, key: string, text: string): void {
    const existing = this.entries.get(filePath);
    if (existing) {
      this.size -= existing.text.length;
      this.entries.delete(filePath);
    }
    if (text.length > CACHE_BUDGET_CHARS) return;
    this.entries.set(filePath, { key, text });
    this.size += text.length;
    while (this.size > CACHE_BUDGET_CHARS) {
      const [oldestPath, oldest] = this.entries.entries().next().value as [string, CachedText];
      this.entries.delete(oldestPath);
      this.size -= oldest.text.length;
    }
  }

  clear(): void {
    this.entries.clear();
    this.size = 0;
  }
}

const textCache = new TextCache();

export function clearSnippetCache(): void {
  textCache.clear();
}

async function loadText(filePath: string): Promise<string | null> {
  const extractor = extractorManager.getExtractor(filePath);
  if (!extractor) return null;

  let key: string;
  try {
    const stats = await fs.stat(filePath);
    key = `${stats.size}:${Math.trunc(stats.mtimeMs)}`;
  } catch {
    return null; // Deleted or inaccessible since indexing.
  }

  const cached = textCache.get(filePath, key);
  if (cached !== undefined) return cached;

  try {
    const { text } = await extractor.extract(filePath);
    textCache.set(filePath, key, text);
    return text;
  } catch {
    return null;
  }
}

/**
 * Builds up to three snippets around matched terms / phrase positions. Never
 * throws: a missing or unreadable file simply has no snippets.
 */
export interface PhraseSpan {
  /** Token index of the first phrase word. */
  start: number;
  length: number;
}

export async function generateSnippets(
  filePath: string,
  matchedTerms: string[],
  phraseSpans: PhraseSpan[] = []
): Promise<Snippet[]> {
  const fullText = await loadText(filePath);
  if (!fullText) return [];
  const text = fullText.length > MAX_SCAN_CHARS ? fullText.slice(0, MAX_SCAN_CHARS) : fullText;

  const positions = findMatchPositions(text, new Set(matchedTerms), phraseSpans);
  if (positions.length === 0) {
    return [createSnippet(text, 0, Math.min(text.length, SNIPPET_WINDOW * 2))];
  }

  return clusterPositions(positions)
    .slice(0, MAX_SNIPPETS)
    .map((cluster) => {
      const center = cluster[Math.floor(cluster.length / 2)];
      return createSnippet(
        text,
        Math.max(0, center - SNIPPET_WINDOW),
        Math.min(text.length, center + SNIPPET_WINDOW)
      );
    });
}

function findMatchPositions(
  text: string,
  matchedTerms: Set<string>,
  phraseSpans: PhraseSpan[]
): number[] {
  const tokens = tokenizeWithOffsets(text);
  const positions = new Set<number>();

  for (const { token, start } of tokens) {
    if (matchedTerms.has(token)) positions.add(start);
  }

  // Phrase positions are token indexes in the same tokenization as indexing.
  for (const span of phraseSpans) {
    for (let i = 0; i < span.length; i++) {
      const token = tokens[span.start + i];
      if (token) positions.add(token.start);
    }
  }

  return Array.from(positions).sort((a, b) => a - b);
}

function clusterPositions(positions: number[]): number[][] {
  const clusters: number[][] = [[positions[0]]];
  for (let i = 1; i < positions.length; i++) {
    const lastCluster = clusters[clusters.length - 1];
    if (positions[i] - lastCluster[lastCluster.length - 1] <= MERGE_DISTANCE) {
      lastCluster.push(positions[i]);
    } else {
      clusters.push([positions[i]]);
    }
  }
  return clusters;
}

function createSnippet(text: string, start: number, end: number): Snippet {
  const MAX_EXPAND = 40;
  let adjustedStart = start;
  let adjustedEnd = end;
  while (adjustedStart > 0 && start - adjustedStart < MAX_EXPAND && /\S/.test(text[adjustedStart - 1])) {
    adjustedStart--;
  }
  while (adjustedEnd < text.length && adjustedEnd - end < MAX_EXPAND && /\S/.test(text[adjustedEnd])) {
    adjustedEnd++;
  }

  let snippetText = text.slice(adjustedStart, adjustedEnd).replace(/\s+/g, ' ').trim();
  if (adjustedStart > 0) snippetText = '…' + snippetText;
  if (adjustedEnd < text.length) snippetText = snippetText + '…';

  return { text: snippetText, start: adjustedStart, end: adjustedEnd };
}
