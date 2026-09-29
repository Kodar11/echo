import type Database from 'better-sqlite3';
import { throwIfCancelled } from '../indexer/cancellation.js';
import { getDatabase } from './connection.js';

/**
 * All mutations of Files / Terms / Postings go through this module so the
 * inverted index invariants hold after every committed transaction:
 *
 * - a Files row and its complete set of Postings are written atomically;
 * - Terms.document_frequency == number of Postings rows for that term;
 * - Terms with no postings do not exist;
 * - a file keeps its id across re-indexing.
 */

export interface FileIndexData {
  path: string;
  size: number;
  modifiedTime: number;
  docLength: number;
  language: string | null;
  contentHash: string | null;
  author: string | null;
  createdAt: number | null;
  extension: string | null;
  /** term -> token positions (see languageProcessor for the position model). */
  positions: Map<string, number[]>;
}

interface Statements {
  getFileIdByPath: Database.Statement;
  insertFile: Database.Statement;
  updateFile: Database.Statement;
  touchFile: Database.Statement;
  deleteFile: Database.Statement;
  decrementTermsOfFile: Database.Statement;
  deletePostingsOfFile: Database.Statement;
  upsertTerm: Database.Statement;
  insertPosting: Database.Statement;
  deleteUnusedTerms: Database.Statement;
}

const statementCache = new WeakMap<Database.Database, Statements>();

function statements(db: Database.Database): Statements {
  let cached = statementCache.get(db);
  if (cached) return cached;
  cached = {
    getFileIdByPath: db.prepare('SELECT id FROM Files WHERE path = ?'),
    insertFile: db.prepare(
      `INSERT INTO Files
       (path, size, modified_time, doc_length, indexed_at, language, content_hash, author, created_at, extension)
       VALUES (@path, @size, @modifiedTime, @docLength, @indexedAt, @language, @contentHash, @author, @createdAt, @extension)`
    ),
    updateFile: db.prepare(
      `UPDATE Files SET
         size = @size, modified_time = @modifiedTime, doc_length = @docLength,
         indexed_at = @indexedAt, language = @language, content_hash = @contentHash,
         author = @author, created_at = @createdAt, extension = @extension
       WHERE id = @id`
    ),
    touchFile: db.prepare(
      'UPDATE Files SET size = ?, modified_time = ?, indexed_at = ? WHERE id = ?'
    ),
    deleteFile: db.prepare('DELETE FROM Files WHERE id = ?'),
    decrementTermsOfFile: db.prepare(
      `UPDATE Terms SET document_frequency = document_frequency - 1
       WHERE id IN (SELECT term_id FROM Postings WHERE file_id = ?)`
    ),
    deletePostingsOfFile: db.prepare('DELETE FROM Postings WHERE file_id = ?'),
    upsertTerm: db.prepare(
      `INSERT INTO Terms (term, document_frequency) VALUES (?, 1)
       ON CONFLICT(term) DO UPDATE SET document_frequency = document_frequency + 1
       RETURNING id`
    ),
    insertPosting: db.prepare(
      'INSERT INTO Postings (term_id, file_id, term_frequency, positions) VALUES (?, ?, ?, ?)'
    ),
    // Served by the partial index idx_terms_zero_df, so this does not scan Terms.
    deleteUnusedTerms: db.prepare('DELETE FROM Terms WHERE document_frequency = 0'),
  };
  statementCache.set(db, cached);
  return cached;
}

function detachPostings(s: Statements, fileId: number): void {
  s.decrementTermsOfFile.run(fileId);
  s.deletePostingsOfFile.run(fileId);
}

/**
 * Atomically replaces the indexed content of one file (inserting it if new).
 * The cancellation signal is checked synchronously inside the transaction, so
 * a cancelled session never commits this write.
 */
export function writeFileIndex(data: FileIndexData, signal?: AbortSignal): number {
  const db = getDatabase();
  const s = statements(db);

  return db.transaction(() => {
    throwIfCancelled(signal);

    const params = {
      path: data.path,
      size: data.size,
      modifiedTime: Math.trunc(data.modifiedTime),
      docLength: data.docLength,
      indexedAt: Date.now(),
      language: data.language,
      contentHash: data.contentHash,
      author: data.author,
      createdAt: data.createdAt,
      extension: data.extension,
    };

    const existing = s.getFileIdByPath.get(data.path) as { id: number } | undefined;
    let fileId: number;
    if (existing) {
      fileId = existing.id;
      detachPostings(s, fileId);
      s.updateFile.run({ ...params, id: fileId });
    } else {
      fileId = Number(s.insertFile.run(params).lastInsertRowid);
    }

    for (const [term, positions] of data.positions) {
      const { id: termId } = s.upsertTerm.get(term) as { id: number };
      s.insertPosting.run(termId, fileId, positions.length, JSON.stringify(positions));
    }

    s.deleteUnusedTerms.run();
    return fileId;
  })();
}

/** Records new size/mtime for a file whose content hash did not change. */
export function touchIndexedFile(
  fileId: number,
  size: number,
  modifiedTime: number,
  signal?: AbortSignal
): void {
  const db = getDatabase();
  const s = statements(db);
  db.transaction(() => {
    throwIfCancelled(signal);
    s.touchFile.run(size, Math.trunc(modifiedTime), Date.now(), fileId);
  })();
}

/** Removes a file and its postings. Returns false if it was not indexed. */
export function removeFileFromIndex(filePath: string, signal?: AbortSignal): boolean {
  const db = getDatabase();
  const s = statements(db);
  return db.transaction(() => {
    throwIfCancelled(signal);
    const existing = s.getFileIdByPath.get(filePath) as { id: number } | undefined;
    if (!existing) return false;
    detachPostings(s, existing.id);
    s.deleteFile.run(existing.id);
    s.deleteUnusedTerms.run();
    return true;
  })();
}

/** Deletes every indexed file, term and posting (folders and settings stay). */
export function clearIndexData(): void {
  const db = getDatabase();
  db.transaction(() => {
    db.exec('DELETE FROM Postings; DELETE FROM Files; DELETE FROM Terms;');
    db.exec('DELETE FROM IndexingFailures');
    db.exec('UPDATE IndexedFolders SET last_synced_at = NULL');
  })();
}
