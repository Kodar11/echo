import fs from 'fs/promises';
import path from 'path';
import { getFileByPath } from '../database/files.js';
import {
  clearIndexingFailure,
  recordIndexingFailure,
  type FailureCategory,
} from '../database/indexingFailures.js';
import {
  removeFileFromIndex,
  touchIndexedFile,
  writeFileIndex,
} from '../database/indexWriter.js';
import { extractorManager } from '../services/extractors/ExtractorManager.js';
import { getLogger } from '../services/logger/logger.js';
import { isCancellation, throwIfCancelled } from './cancellation.js';
import { categorizeError, errorMessage, isNotFoundError } from './errors.js';
import { computeFileHash } from './hash.js';
import { loadIndexingSettings, type IndexingSettings } from './indexingSettings.js';
import { tokenize } from './tokenizer.js';

export type TaskStatus =
  | 'indexed'
  | 'unchanged'
  | 'deleted'
  | 'skipped'
  | 'failed'
  | 'cancelled';

export type SkipReason = 'unsupported' | 'too_large' | 'not_a_file' | 'missing';

export interface TaskOutcome {
  status: TaskStatus;
  /** For 'indexed': whether the file was new or previously indexed. */
  change?: 'added' | 'modified';
  reason?: SkipReason;
  category?: FailureCategory;
  message?: string;
}

export interface IndexFileOptions {
  signal?: AbortSignal;
  settings?: IndexingSettings;
  /** Re-extract even if size/mtime/hash are unchanged (config change). */
  force?: boolean;
}

/**
 * Brings the index entry for one path in line with the file on disk.
 *
 * Change detection is ordered cheapest-first: stat (size + mtime) → content
 * hash → extraction. A file that fails is recorded in IndexingFailures and its
 * previous index entry, if any, is left untouched; a new file that fails gets
 * no Files row. The final write replaces the file's postings atomically.
 */
export async function indexSingleFile(
  filePath: string,
  options: IndexFileOptions = {}
): Promise<TaskOutcome> {
  const { signal, force = false } = options;
  const settings = options.settings ?? loadIndexingSettings();

  try {
    throwIfCancelled(signal);

    const extractor = extractorManager.getExtractor(filePath);
    if (!extractor) {
      // The extension is not (or no longer) indexable.
      const removed = removeFileFromIndex(filePath, signal);
      clearIndexingFailure(filePath);
      return removed
        ? { status: 'deleted' }
        : { status: 'skipped', reason: 'unsupported' };
    }

    let stats;
    try {
      stats = await fs.stat(filePath);
    } catch (err) {
      if (isNotFoundError(err)) {
        // The file vanished before we got to it: make the index agree.
        const removed = removeFileFromIndex(filePath, signal);
        clearIndexingFailure(filePath);
        return removed ? { status: 'deleted' } : { status: 'skipped', reason: 'missing' };
      }
      return fail(filePath, err, 'read');
    }
    throwIfCancelled(signal);

    if (!stats.isFile()) {
      return { status: 'skipped', reason: 'not_a_file' };
    }

    const fileState = { size: stats.size, modifiedTime: Math.trunc(stats.mtimeMs) };

    if (settings.maxFileSizeBytes > 0 && stats.size > settings.maxFileSizeBytes) {
      const removed = removeFileFromIndex(filePath, signal);
      clearIndexingFailure(filePath);
      return removed
        ? { status: 'deleted', reason: 'too_large' }
        : { status: 'skipped', reason: 'too_large' };
    }

    const existing = getFileByPath(filePath);

    if (
      !force &&
      existing &&
      existing.content_hash &&
      existing.size === fileState.size &&
      existing.modified_time === fileState.modifiedTime
    ) {
      return { status: 'unchanged' };
    }

    let contentHash: string;
    try {
      contentHash = await computeFileHash(filePath, signal);
    } catch (err) {
      if (isCancellation(err)) throw err;
      return fail(filePath, err, 'read', fileState);
    }
    throwIfCancelled(signal);

    if (!force && existing && existing.content_hash === contentHash) {
      // Touched but not changed: refresh size/mtime, skip extraction.
      touchIndexedFile(existing.id, fileState.size, fileState.modifiedTime, signal);
      clearIndexingFailure(filePath);
      return { status: 'unchanged' };
    }

    let extracted;
    try {
      // Extractors cannot be interrupted; if the session is cancelled
      // meanwhile, the result is discarded by the checks below.
      extracted = await extractor.extract(filePath);
    } catch (err) {
      return fail(filePath, err, 'extract', fileState);
    }
    throwIfCancelled(signal);

    const { tokens, positions, language } = tokenize(extracted.text, {
      detectLanguage: settings.detectLanguage,
      removeStopWords: settings.removeStopWords,
    });
    throwIfCancelled(signal);

    try {
      writeFileIndex(
        {
          path: filePath,
          size: fileState.size,
          modifiedTime: fileState.modifiedTime,
          docLength: tokens.length,
          language,
          contentHash,
          author: settings.indexMetadata ? extracted.author ?? null : null,
          createdAt: settings.indexMetadata ? extracted.createdAt ?? null : null,
          extension: path.extname(filePath).toLowerCase() || null,
          positions,
        },
        signal
      );
    } catch (err) {
      if (isCancellation(err)) throw err;
      return fail(filePath, err, 'extract', fileState, 'database_error');
    }

    clearIndexingFailure(filePath);
    return { status: 'indexed', change: existing ? 'modified' : 'added' };
  } catch (err) {
    if (isCancellation(err)) return { status: 'cancelled' };
    return fail(filePath, err, 'extract');
  }
}

export function deleteSingleFile(filePath: string, signal?: AbortSignal): TaskOutcome {
  try {
    const removed = removeFileFromIndex(filePath, signal);
    clearIndexingFailure(filePath);
    return removed ? { status: 'deleted' } : { status: 'skipped', reason: 'missing' };
  } catch (err) {
    if (isCancellation(err)) return { status: 'cancelled' };
    return fail(filePath, err, 'extract', undefined, 'database_error');
  }
}

function fail(
  filePath: string,
  err: unknown,
  stage: 'read' | 'extract',
  fileState?: { size: number; modifiedTime: number },
  forcedCategory?: FailureCategory
): TaskOutcome {
  const message = errorMessage(err);
  const category = forcedCategory ?? categorizeError(err, stage);
  try {
    recordIndexingFailure(filePath, category, message, fileState);
  } catch (recordErr) {
    getLogger().error(
      'index',
      'singleFileIndexer',
      `Could not record failure for ${filePath}: ${errorMessage(recordErr)}`
    );
  }
  getLogger().error(
    'index',
    'singleFileIndexer',
    `Failed to index ${filePath} [${category}]: ${message.slice(0, 500)}`
  );
  return { status: 'failed', category, message };
}
