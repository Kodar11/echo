import type Database from 'better-sqlite3';
import {
  getFileCount,
  getFilePathsByPrefix,
  getIndexMetadata,
  getInProgressRuns,
  markRunFailed,
  recordIndexingFailure,
  setIndexingStatus,
} from '../../database/index.js';
import { getLogger } from '../logger/logger.js';

export class RecoveryManager {
  private database: Database.Database;

  constructor(database: Database.Database) {
    this.database = database;
  }

  /**
   * Detects and repairs the aftermath of an unexpected shutdown.
   * Should be called once during startup, before normal indexing begins.
   */
  checkAndRecover(autoRecover = true): RecoveryResult {
    getLogger().info('index', 'RecoveryManager', 'Checking for interrupted indexing sessions');

    const metadata = getIndexMetadata();
    const inProgressRuns = getInProgressRuns();
    const partialFiles = this.findPartialFiles();

    const interruptedRuns = inProgressRuns.length;
    const needsRecovery =
      metadata.status === 'indexing' || interruptedRuns > 0 || partialFiles.length > 0;

    if (!needsRecovery) {
      return {
        recovered: false,
        interruptedRuns: 0,
        partialFiles: 0,
        message: 'No interrupted indexing session found.',
      };
    }

    getLogger().warn(
      'index',
      'RecoveryManager',
      `Interrupted session detected: ${interruptedRuns} run(s), ${partialFiles.length} partial file(s)`
    );

    // Mark all in-progress runs as failed.
    for (const run of inProgressRuns) {
      markRunFailed(run.id, 'Interrupted by unexpected shutdown');
    }

    // Clean up partial files: files with no postings are re-marked for indexing.
    if (partialFiles.length > 0) {
      for (const filePath of partialFiles) {
        recordIndexingFailure(
          filePath,
          'extraction_failed',
          'Partially indexed during previous session; will retry'
        );
      }
    }

    // Reset metadata to a healthy state.
    setIndexingStatus('indexed');

    const result: RecoveryResult = {
      recovered: true,
      interruptedRuns,
      partialFiles: partialFiles.length,
      message: `Recovered from interrupted indexing session: ${interruptedRuns} run(s) marked failed, ${partialFiles.length} partial file(s) queued for re-indexing.`,
    };

    getLogger().info('index', 'RecoveryManager', result.message);

    return result;
  }

  /**
   * Returns file paths that exist in Files but have no postings.
   * These are the result of a crash during indexing.
   */
  findPartialFiles(): string[] {
    const rows = this.database
      .prepare(
        `SELECT f.path
         FROM Files f
         LEFT JOIN Postings p ON p.file_id = f.id
         GROUP BY f.id
         HAVING COUNT(p.term_id) = 0`
      )
      .all() as { path: string }[];
    return rows.map((r) => r.path);
  }

  /**
   * Recomputes metadata counters from actual table counts.
   */
  reconcileMetadataCounters(): void {
    const fileCount = getFileCount();
    const termCount = this.database
      .prepare('SELECT COUNT(*) as count FROM Terms')
      .get() as { count: number };

    this.database
      .prepare(
        `UPDATE IndexMetadata
         SET total_indexed_files = ?, total_indexed_terms = ?
         WHERE id = 1`
      )
      .run(fileCount, termCount.count);

    getLogger().info(
      'index',
      'RecoveryManager',
      `Reconciled metadata counters: ${fileCount} files, ${termCount.count} terms`
    );
  }
}
