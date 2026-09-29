import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegrityManager } from './IntegrityManager.js';
import { setupTestDatabase, teardownTestDatabase } from '../../test/testDb.js';
import { getDatabase } from '../../database/connection.js';
import { insertFile } from '../../database/files.js';
import { removeFileFromIndex, writeFileIndex } from '../../database/indexWriter.js';

function write(path: string, terms: Record<string, number[]>): number {
  return writeFileIndex({
    path,
    size: 10,
    modifiedTime: 1000,
    docLength: Object.values(terms).reduce((n, p) => n + p.length, 0),
    language: null,
    contentHash: `hash-${path}`,
    author: null,
    createdAt: null,
    extension: '.txt',
    positions: new Map(Object.entries(terms)),
  });
}

function reconcileMetadata(): void {
  getDatabase().exec(`UPDATE IndexMetadata SET
    total_indexed_files = (SELECT COUNT(*) FROM Files),
    total_indexed_terms = (SELECT COUNT(*) FROM Terms) WHERE id = 1`);
}

describe('IntegrityManager', () => {
  let dbInfo: { dbPath: string };
  let manager: IntegrityManager;

  beforeEach(() => {
    dbInfo = setupTestDatabase();
    manager = new IntegrityManager(getDatabase());
  });

  afterEach(() => {
    teardownTestDatabase(dbInfo.dbPath);
  });

  it('reports zero issues for a fresh empty database', () => {
    const report = manager.verify();
    expect(report.issues).toEqual([]);
    expect(report.healthy).toBe(true);
  });

  it('reports zero issues after indexing, re-indexing and deleting through the writer', () => {
    write('/a.txt', { alpha: [0], shared: [1] });
    write('/b.txt', { beta: [0], shared: [1] });
    write('/a.txt', { gamma: [0] }); // re-index: alpha disappears
    removeFileFromIndex('/b.txt'); // beta and shared disappear
    reconcileMetadata();

    const report = manager.verify();
    expect(report.issues).toEqual([]);
    const terms = getDatabase().prepare('SELECT term FROM Terms ORDER BY term').all();
    expect(terms).toEqual([{ term: 'gamma' }]);
  });

  it('does not report empty documents (doc_length 0, no postings) as broken', () => {
    insertFile('/empty.txt', 0, Date.now(), 0, Date.now());
    reconcileMetadata();
    expect(manager.verify().healthy).toBe(true);
  });

  it('detects orphan terms and document-frequency drift', () => {
    write('/a.txt', { alpha: [0] });
    getDatabase().exec("INSERT INTO Terms (term, document_frequency) VALUES ('orphan', 1)");
    getDatabase().exec("UPDATE Terms SET document_frequency = 7 WHERE term = 'alpha'");
    reconcileMetadata();

    const report = manager.verify();
    expect(report.summary).toMatchObject({ orphan_term: 1, document_frequency_mismatch: 1 });
  });

  it('detects partially written files', () => {
    insertFile('/partial.txt', 100, Date.now(), 12, Date.now());
    reconcileMetadata();
    const report = manager.verify();
    expect(report.issues.some((i) => i.type === 'partial_file')).toBe(true);
  });

  it('detects invalid metadata counters', () => {
    getDatabase().prepare('UPDATE IndexMetadata SET total_indexed_files = 99 WHERE id = 1').run();
    const report = manager.verify();
    expect(report.issues.some((i) => i.type === 'invalid_metadata')).toBe(true);
  });

  it('detects schema problems instead of trusting migration bookkeeping', () => {
    getDatabase().exec('ALTER TABLE IndexMetadata DROP COLUMN last_synced_at');
    const report = manager.verify();
    expect(report.issues.map((i) => i.type)).toEqual(['schema_mismatch']);
    expect(report.issues[0].details).toMatch(/last_synced_at/);
  });

  it('repairs data issues back to a healthy state', () => {
    write('/a.txt', { alpha: [0] });
    getDatabase().exec("INSERT INTO Terms (term, document_frequency) VALUES ('orphan', 1)");
    getDatabase().exec("UPDATE Terms SET document_frequency = 7 WHERE term = 'alpha'");
    insertFile('/partial.txt', 100, Date.now(), 12, Date.now());

    const repairReport = manager.verifyAndRepair();
    expect(repairReport.repaired).toBe(true);
    expect(manager.verify().healthy).toBe(true);
  });

  it('passes pragma integrity check', () => {
    expect(manager.runPragmaIntegrityCheck().ok).toBe(true);
  });
});
