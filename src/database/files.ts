import { getDatabase } from './connection.js';

export interface FileRecord {
  id: number;
  path: string;
  size: number;
  modified_time: number;
  doc_length: number;
  indexed_at: number;
}

export function insertFile(
  path: string,
  size: number,
  modifiedTime: number,
  docLength: number,
  indexedAt: number
): number {
  const db = getDatabase();
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO Files (path, size, modified_time, doc_length, indexed_at) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(path, size, modifiedTime, docLength, indexedAt);
  return Number(result.lastInsertRowid);
}

export function getFileByPath(path: string): FileRecord | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM Files WHERE path = ?');
  return stmt.get(path) as FileRecord | undefined;
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

export function getFileCount(): number {
  const db = getDatabase();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM Files');
  const row = stmt.get() as { count: number };
  return row.count;
}

export function deleteFileByPath(path: string): void {
  const db = getDatabase();
  const file = getFileByPath(path);
  if (!file) return;
  db.prepare('DELETE FROM Postings WHERE file_id = ?').run(file.id);
  db.prepare('DELETE FROM Files WHERE id = ?').run(file.id);
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
