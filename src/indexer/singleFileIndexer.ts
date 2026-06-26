import fs from 'fs/promises';
import path from 'path';
import {
  deleteFileById,
  getFileByPath,
  insertFile,
} from '../database/files.js';
import {
  deletePostingsForFileReturningTerms,
  insertPosting,
} from '../database/postings.js';
import { getBooleanSetting } from '../database/settings.js';
import { getOrCreateTerm } from '../database/terms.js';
import { getExtractor, isSupportedFile } from '../file-extractors/registry.js';
import { SETTING_KEYS } from '../settings/keys.js';
import { computeFileHash } from './hash.js';
import { tokenize } from './tokenizer.js';

export async function indexSingleFile(filePath: string): Promise<boolean> {
  if (!isSupportedFile(filePath)) {
    return false;
  }

  const extractor = getExtractor(filePath);
  if (!extractor) {
    return false;
  }

  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch {
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
    console.error(`Failed to hash ${filePath}:`, err);
  }

  let extracted;
  try {
    extracted = await extractor.extract(filePath);
  } catch (err) {
    console.error(`Failed to extract ${filePath}:`, err);
    return false;
  }

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

  deletePostingsForFileReturningTerms(fileId);

  for (const [term, termPositions] of positions.entries()) {
    const termId = getOrCreateTerm(term);
    insertPosting(termId, fileId, termPositions.length, termPositions);
  }

  return true;
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
