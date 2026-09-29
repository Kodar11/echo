import fs from 'fs';
import {
  getDatabasePath,
  getFileCount,
  getFolders,
  getIndexMetadata,
  getIndexingFailureCount,
  getTermCount,
} from '../../database/index.js';

export type HealthStatus = 'healthy' | 'warning' | 'error';

export interface HealthStats {
  status: HealthStatus;
  totalFiles: number;
  indexedFiles: number;
  /** Files that could not be indexed (unreadable, extraction failed, …). */
  failedFiles: number;
  /** Excluded by ignore rules or hidden. */
  ignoredFiles: number;
  /** Extension has no enabled extractor. */
  unsupportedFiles: number;
  /** Larger than the configured size limit. */
  oversizedFiles: number;
  /** Files or folders that could not be read during the last full sync. */
  inaccessibleFiles: number;
  pendingJobs: number;
  indexingActive: boolean;
  lastRunStatus: string | null;
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
  getHealthStats(pendingJobs = 0, indexingActive = false): HealthStats {
    const metadata = getIndexMetadata();
    const totalFiles = getFileCount();
    const failedFiles = getIndexingFailureCount(false);

    const status = this.computeStatus({
      lastRunStatus: metadata.last_run_status,
      indexStatus: metadata.status,
      totalFiles,
      failedFiles,
      lastSyncedAt: metadata.last_synced_at,
      pendingJobs,
    });

    return {
      status,
      totalFiles,
      indexedFiles: totalFiles,
      failedFiles,
      ignoredFiles: metadata.ignored_files_count,
      unsupportedFiles: metadata.unsupported_files_count,
      oversizedFiles: metadata.oversized_files_count,
      inaccessibleFiles: metadata.inaccessible_files_count,
      pendingJobs,
      indexingActive,
      lastRunStatus: metadata.last_run_status,
      totalFolders: getFolders().length,
      totalTerms: getTermCount(),
      databaseSizeBytes: this.getDatabaseSize(),
      lastIndexedAt: metadata.last_indexed_at,
      lastSyncedAt: metadata.last_synced_at,
      lastIndexDurationMs: metadata.last_index_duration_ms,
      averageIndexDurationMs: metadata.average_index_duration_ms,
      totalIndexingRuns: metadata.total_indexing_runs,
    };
  }

  private computeStatus(input: {
    lastRunStatus: string | null;
    indexStatus: string;
    totalFiles: number;
    failedFiles: number;
    lastSyncedAt: number | null;
    pendingJobs: number;
  }): HealthStatus {
    if (input.indexStatus === 'error' || input.lastRunStatus === 'failed') return 'error';

    if (input.totalFiles > 0 && input.failedFiles / input.totalFiles > FAILURE_RATIO_THRESHOLD) {
      return 'error';
    }

    if (
      input.failedFiles > 0 ||
      input.pendingJobs > 0 ||
      input.lastRunStatus === 'completed_with_errors' ||
      input.lastRunStatus === 'cancelled' ||
      (input.lastSyncedAt !== null && Date.now() - input.lastSyncedAt > STALE_SYNC_THRESHOLD_MS)
    ) {
      return 'warning';
    }

    return 'healthy';
  }

  private getDatabaseSize(): number {
    try {
      return fs.statSync(getDatabasePath()).size;
    } catch {
      return 0;
    }
  }
}

export const healthManager = new HealthManager();
