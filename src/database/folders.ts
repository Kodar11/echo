import { normalizeFsPath } from '../indexer/paths.js';
import { getDatabase } from './connection.js';

export interface FolderRecord {
  id: number;
  path: string;
  enabled: number;
  added_at: number;
  /** When a full sync of this folder last completed; null = never synced. */
  last_synced_at: number | null;
}

export function addFolder(folderPath: string): FolderRecord {
  const db = getDatabase();
  const normalized = normalizeFsPath(folderPath);
  db.prepare(
    'INSERT OR IGNORE INTO IndexedFolders (path, enabled, added_at) VALUES (?, 1, ?)'
  ).run(normalized, Date.now());
  return db
    .prepare('SELECT * FROM IndexedFolders WHERE path = ?')
    .get(normalized) as FolderRecord;
}

export function removeFolder(id: number): void {
  getDatabase().prepare('DELETE FROM IndexedFolders WHERE id = ?').run(id);
}

export function getFolderById(id: number): FolderRecord | undefined {
  return getDatabase()
    .prepare('SELECT * FROM IndexedFolders WHERE id = ?')
    .get(id) as FolderRecord | undefined;
}

export function getFolders(): FolderRecord[] {
  return getDatabase()
    .prepare('SELECT * FROM IndexedFolders ORDER BY id')
    .all() as FolderRecord[];
}

export function getEnabledFolders(): FolderRecord[] {
  return getDatabase()
    .prepare('SELECT * FROM IndexedFolders WHERE enabled = 1 ORDER BY id')
    .all() as FolderRecord[];
}

export function setFolderEnabled(
  id: number,
  enabled: boolean
): FolderRecord | undefined {
  const db = getDatabase();
  // Re-enabling a folder means its disk state is unknown again.
  db.prepare(
    `UPDATE IndexedFolders
     SET enabled = ?, last_synced_at = CASE WHEN ? = 1 THEN NULL ELSE last_synced_at END
     WHERE id = ?`
  ).run(enabled ? 1 : 0, enabled ? 1 : 0, id);
  return getFolderById(id);
}

export function markFoldersSynced(ids: number[], syncedAt: number): void {
  if (ids.length === 0) return;
  const db = getDatabase();
  const stmt = db.prepare('UPDATE IndexedFolders SET last_synced_at = ? WHERE id = ?');
  db.transaction(() => {
    for (const id of ids) stmt.run(syncedAt, id);
  })();
}

/** Enabled folders whose disk state has never been reconciled with the index. */
export function getUnsyncedEnabledFolders(): FolderRecord[] {
  return getDatabase()
    .prepare(
      'SELECT * FROM IndexedFolders WHERE enabled = 1 AND last_synced_at IS NULL ORDER BY id'
    )
    .all() as FolderRecord[];
}
