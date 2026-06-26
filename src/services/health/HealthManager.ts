import fs from 'fs';
import {
  getDatabasePath,
  getFileCount,
  getFolders,
  getIndexMetadata,
  getIndexingFailureCount,
  getIgnoredFilesCount,
  getTermCount,
} from '../../database/index.js';

export type HealthStatus = 'healthy' | 'warning' | 'error';

export interface HealthStats {
  status: HealthStatus;
  totalFiles: number;
  indexedFiles: number;
  failedFiles: number;
  ignoredFiles: number;
  pendingJobs: number;
  totalFolders: number;
  totalTerms: number;
  databaseSizeBytes: number;
  lastIndexedAt: number | null;
  lastSyncedAt: number | null;
  lastIndexDurationMs: number | null;
  averageIndexDurationMs: number | null;
  totalIndexingRuns: number;
}

const FAILURE_RATIO_THRESHOLD = 0.1;
const STALE_SYNC_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export class HealthManager {
  getHealthStats(pendingJobs = 0): HealthStats {
    const metadata = getIndexMetadata();
    const totalFiles = getFileCount();
    const failedFiles = getIndexingFailureCount(false);
    const totalFolders = getFolders().length;
    const totalTerms = getTermCount();
    const databaseSizeBytes = this.getDatabaseSize();

    const ignoredFiles = getIgnoredFilesCount();

    const status = this.computeStatus(
      metadata.status,
      totalFiles,
      failedFiles,
      metadata.last_synced_at,
      pendingJobs
    );

    return {
      status,
      totalFiles,
      indexedFiles: totalFiles,
      failedFiles,
      ignoredFiles,
      pendingJobs,
      totalFolders,
      totalTerms,
      databaseSizeBytes,
      lastIndexedAt: metadata.last_indexed_at,
      lastSyncedAt: metadata.last_synced_at,
      lastIndexDurationMs: metadata.last_index_duration_ms,
      averageIndexDurationMs: metadata.average_index_duration_ms,
      totalIndexingRuns: metadata.total_indexing_runs,
    };
  }

  private computeStatus(
    indexStatus: string,
    totalFiles: number,
    failedFiles: number,
    lastSyncedAt: number | null,
    pendingJobs: number
  ): HealthStatus {
    if (indexStatus === 'error') return 'error';

    if (totalFiles > 0 && failedFiles / totalFiles > FAILURE_RATIO_THRESHOLD) {
      return 'error';
    }

    if (
      failedFiles > 0 ||
      pendingJobs > 0 ||
      (lastSyncedAt && Date.now() - lastSyncedAt > STALE_SYNC_THRESHOLD_MS)
    ) {
      return 'warning';
    }

    return 'healthy';
  }

  private getDatabaseSize(): number {
    const dbPath = getDatabasePath();
    try {
      return fs.statSync(dbPath).size;
    } catch {
      return 0;
    }
  }
}

export const healthManager = new HealthManager();
