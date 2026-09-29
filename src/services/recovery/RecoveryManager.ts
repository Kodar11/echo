import type Database from 'better-sqlite3';
import { getDatabase } from '../../database/connection.js';
import {
  computeRestingStatus,
  getIndexMetadata,
  setIndexingStatus,
} from '../../database/indexMetadata.js';
import { getInProgressRuns, markRunInterrupted } from '../../database/indexingRuns.js';
import { getLogger } from '../logger/logger.js';

export interface RecoveryResultRecord {
  recovered: boolean;
  interruptedRuns: number;
  partialFiles: number;
  staleLockReleased: boolean;
  message: string;
}

/**
 * Cleans up after a session that ended without finalization (crash, kill,
 * power loss). Must run once at startup, before any indexing session, while
 * this process is the only instance (see requestSingleInstanceLock in main).
 */
export class RecoveryManager {
  constructor(private readonly explicitDatabase?: Database.Database) {}

  private get database(): Database.Database {
    return this.explicitDatabase ?? getDatabase();
  }

  /**
   * @param autoRecover when false, only the bookkeeping required for indexing
   *   to work again (runs, lock, status) is repaired; partially written files
   *   are reported but left in place.
   */
  checkAndRecover(autoRecover = true): RecoveryResultRecord {
    const db = this.database;
    const metadata = getIndexMetadata();
    const inProgressRuns = getInProgressRuns();
    const partialFiles = this.findPartialFiles();
    const lockRow = db.prepare('SELECT owner FROM IndexLock WHERE id = 1').get() as
      | { owner: string }
      | undefined;

    const needsRecovery =
      metadata.status === 'indexing' ||
      inProgressRuns.length > 0 ||
      partialFiles.length > 0 ||
      lockRow !== undefined;

    if (!needsRecovery) {
      return {
        recovered: false,
        interruptedRuns: 0,
        partialFiles: 0,
        staleLockReleased: false,
        message: 'No interrupted indexing session found.',
      };
    }

    getLogger().warn(
      'index',
      'RecoveryManager',
      `Interrupted session detected: ${inProgressRuns.length} run(s), ${partialFiles.length} partial file(s), lock=${lockRow?.owner ?? 'none'}`
    );

    db.transaction(() => {
      for (const run of inProgressRuns) {
        markRunInterrupted(run.id, 'Interrupted by unexpected shutdown');
      }
      if (lockRow) {
        db.prepare('DELETE FROM IndexLock WHERE id = 1').run();
      }
      if (autoRecover && partialFiles.length > 0) {
        // Remove them entirely; the next sync sees them as new and re-indexes.
        db.exec(`DELETE FROM Files
                 WHERE doc_length > 0
                   AND NOT EXISTS (SELECT 1 FROM Postings p WHERE p.file_id = Files.id)`);
      }
    })();

    setIndexingStatus(computeRestingStatus());

    const result: RecoveryResultRecord = {
      recovered: true,
      interruptedRuns: inProgressRuns.length,
      partialFiles: partialFiles.length,
      staleLockReleased: lockRow !== undefined,
      message:
        `Recovered from an interrupted indexing session: ${inProgressRuns.length} run(s) marked failed` +
        (partialFiles.length > 0
          ? autoRecover
            ? `, ${partialFiles.length} partially indexed file(s) scheduled for re-indexing`
            : `, ${partialFiles.length} partially indexed file(s) left for manual repair`
          : '') +
        '.',
    };
    getLogger().info('index', 'RecoveryManager', result.message);
    return result;
  }

  /** Files that have content (doc_length > 0) but no postings. */
  findPartialFiles(): string[] {
    const rows = this.database
      .prepare(
        `SELECT f.path FROM Files f
         WHERE f.doc_length > 0
           AND NOT EXISTS (SELECT 1 FROM Postings p WHERE p.file_id = f.id)`
      )
      .all() as { path: string }[];
    return rows.map((r) => r.path);
  }

  reconcileMetadataCounters(): void {
    this.database.exec(`UPDATE IndexMetadata SET
      total_indexed_files = (SELECT COUNT(*) FROM Files),
      total_indexed_terms = (SELECT COUNT(*) FROM Terms)
      WHERE id = 1`);
  }
}
