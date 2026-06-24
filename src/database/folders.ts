import { getDatabase } from './connection.js';

export interface FolderRecord {
  id: number;
  path: string;
  enabled: number;
}

export function addFolder(path: string): FolderRecord {
  const db = getDatabase();
  const result = db
    .prepare('INSERT OR IGNORE INTO IndexedFolders (path, enabled) VALUES (?, 1)')
    .run(path);
  const row = db
    .prepare('SELECT * FROM IndexedFolders WHERE path = ?')
    .get(path) as FolderRecord;
  return row;
}

export function removeFolder(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM IndexedFolders WHERE id = ?').run(id);
}

export function getFolders(): FolderRecord[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM IndexedFolders').all() as FolderRecord[];
}

export function setFolderEnabled(
  id: number,
  enabled: boolean
): FolderRecord | undefined {
  const db = getDatabase();
  db.prepare('UPDATE IndexedFolders SET enabled = ? WHERE id = ?').run(
    enabled ? 1 : 0,
    id
  );
  return db.prepare('SELECT * FROM IndexedFolders WHERE id = ?').get(id) as
    | FolderRecord
    | undefined;
}

export function getEnabledFolders(): FolderRecord[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM IndexedFolders WHERE enabled = 1')
    .all() as FolderRecord[];
}
