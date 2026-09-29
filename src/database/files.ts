import path from 'path';
import { isPathInside } from '../indexer/paths.js';
import { getDatabase } from './connection.js';

export interface FileRecord {
  id: number;
  path: string;
  size: number;
  modified_time: number;
  doc_length: number;
  indexed_at: number;
  language: string | null;
  content_hash: string | null;
  author: string | null;
  created_at: number | null;
  extension: string | null;
}

/** The cheap per-file state used by change detection. */
export interface FileState {
  id: number;
  path: string;
  size: number;
  modified_time: number;
  content_hash: string | null;
}

export interface FileMetadata {
  language?: string | null;
  contentHash?: string | null;
  author?: string | null;
  createdAt?: number | null;
  extension?: string | null;
}

/**
 * Inserts a bare Files row without postings. Index writes go through
 * writeFileIndex (src/database/indexWriter.ts); this exists for tests and
 * tooling that need to construct specific database states.
 */
export function insertFile(
  filePath: string,
  size: number,
  modifiedTime: number,
  docLength: number,
  indexedAt: number,
  metadata: FileMetadata = {}
): number {
  const db = getDatabase();
  const extension =
    (metadata.extension ?? path.extname(filePath).toLowerCase()) || null;
  const result = db
    .prepare(
      `INSERT INTO Files
       (path, size, modified_time, doc_length, indexed_at, language, content_hash, author, created_at, extension)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      filePath,
      size,
      Math.trunc(modifiedTime),
      docLength,
      indexedAt,
      metadata.language ?? null,
      metadata.contentHash ?? null,
      metadata.author ?? null,
      metadata.createdAt ?? null,
      extension
    );
  return Number(result.lastInsertRowid);
}

export function getFileByPath(filePath: string): FileRecord | undefined {
  return getDatabase()
    .prepare('SELECT * FROM Files WHERE path = ?')
    .get(filePath) as FileRecord | undefined;
}

export function getFileById(id: number): FileRecord | undefined {
  return getDatabase()
    .prepare('SELECT * FROM Files WHERE id = ?')
    .get(id) as FileRecord | undefined;
}

export function getAllFiles(): FileRecord[] {
  return getDatabase().prepare('SELECT * FROM Files').all() as FileRecord[];
}

export function getAllFileStates(): FileState[] {
  return getDatabase()
    .prepare('SELECT id, path, size, modified_time, content_hash FROM Files')
    .all() as FileState[];
}

/** Indexed file paths located at or below `directory` (path-boundary aware). */
export function getFilePathsUnder(directory: string): string[] {
  const escaped = directory.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = getDatabase()
    .prepare("SELECT path FROM Files WHERE path LIKE ? ESCAPE '\\'")
    .all(`${escaped}%`) as { path: string }[];
  return rows
    .map((row) => row.path)
    .filter((filePath) => isPathInside(filePath, directory));
}

export function getDuplicateFileGroups(): FileRecord[][] {
  const rows = getDatabase()
    .prepare(
      `SELECT * FROM Files
       WHERE content_hash IN (
         SELECT content_hash FROM Files
         WHERE content_hash IS NOT NULL AND content_hash != ''
         GROUP BY content_hash
         HAVING COUNT(*) > 1
       )
       ORDER BY content_hash, path`
    )
    .all() as FileRecord[];

  const groups = new Map<string, FileRecord[]>();
  for (const row of rows) {
    const hash = row.content_hash as string;
    const group = groups.get(hash);
    if (group) group.push(row);
    else groups.set(hash, [row]);
  }
  return Array.from(groups.values());
}

export function getFileCount(): number {
  const row = getDatabase()
    .prepare('SELECT COUNT(*) as count FROM Files')
    .get() as { count: number };
  return row.count;
}
