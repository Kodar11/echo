import fs from 'fs/promises';
import { getDatabase } from '../database/connection.js';
import {
  deleteFilesNotIn,
  getEnabledFolders,
  getFileByPath,
  getFileCount,
  insertFile,
  updateDocumentFrequency,
} from '../database/index.js';
import { deletePostingsForFile, insertPosting } from '../database/postings.js';
import { getOrCreateTerm } from '../database/terms.js';
import { getExtractor } from '../file-extractors/registry.js';
import { crawlDirectory } from './crawler.js';
import { IndexingProgressTracker } from './progress.js';
import { tokenize } from './tokenizer.js';

export const indexerProgress = new IndexingProgressTracker();

let isIndexing = false;

export function getIsIndexing(): boolean {
  return isIndexing;
}

export async function startIndexing(): Promise<void> {
  if (isIndexing) return;
  isIndexing = true;

  try {
    const folders = getEnabledFolders();
    const filePaths: string[] = [];
    for (const folder of folders) {
      const paths = await crawlDirectory(folder.path);
      filePaths.push(...paths);
    }

    indexerProgress.start(filePaths.length);

    const indexedPaths = new Set<string>();

    for (const filePath of filePaths) {
      indexerProgress.setCurrentFile(filePath);
      try {
        await indexFile(filePath);
        indexedPaths.add(filePath);
      } catch (err) {
        console.error(`Failed to index ${filePath}:`, err);
      }
      indexerProgress.incrementProcessed();
    }

    const deleted = deleteFilesNotIn(indexedPaths);
    if (deleted > 0) {
      console.log(`Removed ${deleted} stale files from index`);
    }

    recalculateDocumentFrequencies();

    indexerProgress.setIndexedFiles(getFileCount());
    indexerProgress.complete();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    indexerProgress.error(message);
  } finally {
    isIndexing = false;
  }
}

async function indexFile(filePath: string): Promise<void> {
  const extractor = getExtractor(filePath);
  if (!extractor) return;

  const stats = await fs.stat(filePath);
  const existing = getFileByPath(filePath);

  if (
    existing &&
    existing.size === stats.size &&
    existing.modified_time === stats.mtimeMs
  ) {
    return;
  }

  const text = await extractor.extract(filePath);
  const { tokens, positions } = tokenize(text);
  const docLength = tokens.length;

  const fileId = insertFile(
    filePath,
    stats.size,
    stats.mtimeMs,
    docLength,
    Date.now()
  );

  deletePostingsForFile(fileId);

  for (const [term, termPositions] of positions.entries()) {
    const termId = getOrCreateTerm(term);
    insertPosting(termId, fileId, termPositions.length, termPositions);
  }
}

function recalculateDocumentFrequencies(): void {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT term_id, COUNT(DISTINCT file_id) as df
       FROM Postings
       GROUP BY term_id`
    )
    .all() as { term_id: number; df: number }[];

  for (const row of rows) {
    updateDocumentFrequency(row.term_id, row.df);
  }
}
