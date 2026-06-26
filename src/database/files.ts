import path from 'path';
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

export interface FilePathRecord {
  path: string;
  size: number;
  modified_time: number;
}

export interface FileMetadata {
  language?: string | null;
  contentHash?: string | null;
  author?: string | null;
  createdAt?: number | null;
  extension?: string | null;
}

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
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO Files
     (path, size, modified_time, doc_length, indexed_at, language, content_hash, author, created_at, extension)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    filePath,
    size,
    modifiedTime,
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

export function updateFileMetadata(
  fileId: number,
  metadata: FileMetadata
): void {
  const db = getDatabase();
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (metadata.language !== undefined) {
    sets.push('language = ?');
    values.push(metadata.language);
  }
  if (metadata.contentHash !== undefined) {
    sets.push('content_hash = ?');
    values.push(metadata.contentHash);
  }
  if (metadata.author !== undefined) {
    sets.push('author = ?');
    values.push(metadata.author);
  }
  if (metadata.createdAt !== undefined) {
    sets.push('created_at = ?');
    values.push(metadata.createdAt);
  }
  if (metadata.extension !== undefined) {
    sets.push('extension = ?');
    values.push(metadata.extension);
  }

  if (sets.length === 0) return;

  values.push(fileId);
  db.prepare(`UPDATE Files SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function getFileByPath(filePath: string): FileRecord | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM Files WHERE path = ?');
  return stmt.get(filePath) as FileRecord | undefined;
}

export function getFileById(id: number): FileRecord | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM Files WHERE id = ?');
  return stmt.get(id) as FileRecord | undefined;
}

export function getAllFiles(): FileRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM Files');
  return stmt.all() as FileRecord[];
}

export function getAllFilePaths(): FilePathRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT path, size, modified_time FROM Files');
  return stmt.all() as FilePathRecord[];
}

export function getFilePathsByPrefix(prefix: string): string[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT path FROM Files WHERE path LIKE ?')
    .all(`${prefix}%`) as { path: string }[];
  return rows.map((row) => row.path);
}

export function getFilesByMetadata(
  filters: Partial<Pick<FileRecord, 'language' | 'author' | 'extension'>>
): FileRecord[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const values: (string | number | null)[] = [];

  if (filters.language !== undefined) {
    conditions.push('language = ?');
    values.push(filters.language);
  }
  if (filters.author !== undefined) {
    conditions.push('author = ?');
    values.push(filters.author);
  }
  if (filters.extension !== undefined) {
    conditions.push('extension = ?');
    values.push(filters.extension);
  }

  if (conditions.length === 0) return getAllFiles();

  const stmt = db.prepare(
    `SELECT * FROM Files WHERE ${conditions.join(' AND ')}`
  );
  return stmt.all(...values) as FileRecord[];
}

export function getDuplicateFileGroups(): FileRecord[][] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT content_hash
       FROM Files
       WHERE content_hash IS NOT NULL AND content_hash != ''
       GROUP BY content_hash
       HAVING COUNT(*) > 1`
    )
    .all() as { content_hash: string }[];

  const groups: FileRecord[][] = [];
  const stmt = db.prepare('SELECT * FROM Files WHERE content_hash = ?');
  for (const { content_hash } of rows) {
    const files = stmt.all(content_hash) as FileRecord[];
    if (files.length > 1) {
      groups.push(files);
    }
  }
  return groups;
}

export function getFileCount(): number {
  const db = getDatabase();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM Files');
  const row = stmt.get() as { count: number };
  return row.count;
}

export function deleteFileByPath(filePath: string): void {
  const db = getDatabase();
  const file = getFileByPath(filePath);
  if (!file) return;
  db.prepare('DELETE FROM Postings WHERE file_id = ?').run(file.id);
  db.prepare('DELETE FROM Files WHERE id = ?').run(file.id);
}

export function deleteFileById(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM Postings WHERE file_id = ?').run(id);
  db.prepare('DELETE FROM Files WHERE id = ?').run(id);
}

export function deleteAllFiles(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM Files').run();
}

export function deleteFilesNotIn(paths: Set<string>): number {
  const db = getDatabase();
  const allFiles = getAllFiles();
  let deleted = 0;
  const deletePostings = db.prepare('DELETE FROM Postings WHERE file_id = ?');
  const deleteFile = db.prepare('DELETE FROM Files WHERE id = ?');
  const transaction = db.transaction(() => {
    for (const file of allFiles) {
      if (!paths.has(file.path)) {
        deletePostings.run(file.id);
        deleteFile.run(file.id);
        deleted++;
      }
    }
  });
  transaction();
  return deleted;
}
