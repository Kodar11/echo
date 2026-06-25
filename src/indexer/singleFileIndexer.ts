import fs from 'fs/promises';
import {
  deleteFileById,
  getFileByPath,
  insertFile,
} from '../database/files.js';
import {
  deletePostingsForFileReturningTerms,
  insertPosting,
} from '../database/postings.js';
import { getOrCreateTerm } from '../database/terms.js';
import { getExtractor, isSupportedFile } from '../file-extractors/registry.js';
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

  const existing = getFileByPath(filePath);
  if (
    existing &&
    existing.size === stats.size &&
    existing.modified_time === stats.mtimeMs
  ) {
    return false;
  }

  let text: string;
  try {
    text = await extractor.extract(filePath);
  } catch (err) {
    console.error(`Failed to extract ${filePath}:`, err);
    return false;
  }

  const { tokens, positions } = tokenize(text);
  const docLength = tokens.length;

  const fileId = insertFile(
    filePath,
    stats.size,
    stats.mtimeMs,
    docLength,
    Date.now()
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
