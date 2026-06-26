import fs from 'fs/promises';
import path from 'path';
import {
  clearIndexingFailure,
  deleteFileById,
  getFileByPath,
  insertFile,
  recordIndexingFailure,
} from '../database/index.js';
import {
  deletePostingsForFileReturningTerms,
  insertPosting,
} from '../database/postings.js';
import {
  getBooleanSetting,
  getSetting,
} from '../database/settings.js';
import { getOrCreateTerm } from '../database/terms.js';
import { extractorManager } from '../services/extractors/ExtractorManager.js';
import { getLogger } from '../services/logger/logger.js';
import { SETTING_KEYS } from '../settings/keys.js';
import { computeFileHash } from './hash.js';
import { tokenize } from './tokenizer.js';

export async function indexSingleFile(filePath: string): Promise<boolean> {
  const maxFileSizeBytes = getMaxFileSizeBytes();

  if (!extractorManager.isSupportedFile(filePath)) {
    return false;
  }

  const extractor = extractorManager.getExtractor(filePath);
  if (!extractor) {
    return false;
  }

  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch (err) {
    recordFailure(filePath, err);
    return false;
  }

  if (maxFileSizeBytes > 0 && stats.size > maxFileSizeBytes) {
    getLogger().info(
      'index',
      'singleFileIndexer',
      `Skipping large file ${filePath} (${stats.size} bytes)`
    );
    return false;
  }

  const detectLanguage = getBooleanSetting(SETTING_KEYS.enableLanguageDetection, true);
  const removeStopWords = getBooleanSetting(SETTING_KEYS.removeStopWords, false);
  const indexMetadata = getBooleanSetting(SETTING_KEYS.indexMetadata, true);

  const existing = getFileByPath(filePath);

  // If size and mtime are unchanged and we already have a hash, skip re-indexing.
  if (
    existing &&
    existing.size === stats.size &&
    existing.modified_time === stats.mtimeMs &&
    existing.content_hash
  ) {
    return false;
  }

  let contentHash: string | undefined;
  try {
    contentHash = await computeFileHash(filePath);
  } catch (err) {
    getLogger().error(
      'index',
      'singleFileIndexer',
      `Failed to hash ${filePath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let extracted;
  try {
    extracted = await extractor.extract(filePath);
  } catch (err) {
    recordFailure(filePath, err);
    return false;
  }

  try {
    const { tokens, positions, language } = tokenize(extracted.text, {
      detectLanguage,
      removeStopWords,
    });
    const docLength = tokens.length;

    const metadata = indexMetadata
      ? {
          language,
          contentHash,
          author: extracted.author,
          createdAt: extracted.createdAt,
          extension: path.extname(filePath).toLowerCase() || null,
        }
      : { language, contentHash };

    const fileId = insertFile(
      filePath,
      stats.size,
      stats.mtimeMs,
      docLength,
      Date.now(),
      metadata
    );

    // Clear any previous failure for this file.
    clearIndexingFailure(filePath);

    deletePostingsForFileReturningTerms(fileId);

    for (const [term, termPositions] of positions.entries()) {
      const termId = getOrCreateTerm(term);
      insertPosting(termId, fileId, termPositions.length, termPositions);
    }

    return true;
  } catch (err) {
    recordFailure(filePath, err);
    return false;
  }
}

export function deleteSingleFile(filePath: string): boolean {
  const existing = getFileByPath(filePath);
  if (!existing) {
    return false;
  }

  deletePostingsForFileReturningTerms(existing.id);
  deleteFileById(existing.id);
  return true;
}

function recordFailure(filePath: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const category = categorizeError(message);
  recordIndexingFailure(filePath, category, message);
  getLogger().error(
    'index',
    'singleFileIndexer',
    `Failed to index ${filePath}: ${message}`
  );
}

function categorizeError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('permission') || lower.includes('eacces') || lower.includes('access denied')) {
    return 'permission_denied';
  }
  if (lower.includes('password') || lower.includes('encrypted')) {
    return 'encrypted';
  }
  if (lower.includes('corrupt') || lower.includes('invalid') || lower.includes('unable to deserialize')) {
    return 'corrupted';
  }
  if (lower.includes('locked') || lower.includes('eminuse') || lower.includes('resource busy')) {
    return 'locked';
  }
  if (lower.includes('unsupported') || lower.includes('not supported')) {
    return 'unsupported';
  }
  return 'extraction_failed';
}

function getMaxFileSizeBytes(): number {
  const raw = getSetting(SETTING_KEYS.maxFileSizeBytes);
  if (!raw) return 0;
  const value = parseInt(raw, 10);
  return isNaN(value) ? 0 : value;
}
