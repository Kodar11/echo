import fs from 'fs';
import { getDatabasePath } from '../database/connection.js';
import {
  deleteAllFiles,
  getFileCount,
} from '../database/files.js';
import { getFolders } from '../database/folders.js';
import {
  getIndexMetadata,
  recordIndexingCompleted,
  resetIndexMetadata,
  setIndexingStatus,
} from '../database/indexMetadata.js';
import {
  completeIndexingRun,
  failIndexingRun,
  startIndexingRun,
} from '../database/indexingRuns.js';
import { deleteAllPostings } from '../database/postings.js';
import { deleteAllTerms, getTermCount } from '../database/terms.js';
import { searchEngine } from '../search/engine.js';
import { indexerProgress, startIndexing } from './indexer.js';

export type IndexStatus =
  | 'never_indexed'
  | 'indexing'
  | 'indexed'
  | 'error';

export interface IndexStatistics {
  status: IndexStatus;
  totalIndexedFiles: number;
  totalIndexedFolders: number;
  totalUniqueTerms: number;
  lastIndexedAt: number | null;
  lastIndexDurationMs: number | null;
  averageIndexDurationMs: number | null;
  databaseSizeBytes: number;
  totalIndexingRuns: number;
}

export interface IndexState {
  status: IndexStatus;
  currentFile: string | null;
  processed: number;
  total: number;
  indexedFiles: number;
  error: string | null;
}

const AVERAGE_WINDOW_SIZE = 20;

export class IndexManager {
  private currentRunId: number | null = null;
  private runStartTime = 0;

  constructor() {
    this.handleProgress = this.handleProgress.bind(this);
  }

  initialize(): void {
    this.ensureMetadata();
    this.loadIndex();
  }

  ensureMetadata(): void {
    getIndexMetadata();
  }

  loadIndex(): void {
    const metadata = getIndexMetadata();
    const fileCount = getFileCount();

    if (fileCount === 0) {
      if (metadata.status !== 'indexing' && metadata.status !== 'error') {
        setIndexingStatus('never_indexed');
      }
      searchEngine.rebuildIndex();
      return;
    }

    searchEngine.rebuildIndex();
    if (metadata.status !== 'indexing' && metadata.status !== 'error') {
      setIndexingStatus('indexed');
    }
  }

  async startIndexing(): Promise<void> {
    const metadata = getIndexMetadata();
    if (metadata.status === 'indexing') return;

    this.runStartTime = Date.now();
    this.currentRunId = startIndexingRun();
    setIndexingStatus('indexing');

    const unsubscribe = indexerProgress.subscribe(this.handleProgress);

    try {
      await startIndexing();
      const duration = Date.now() - this.runStartTime;
      const fileCount = getFileCount();
      const termCount = getTermCount();

      completeIndexingRun(this.currentRunId, duration, fileCount);
      recordIndexingCompleted(duration, fileCount, termCount);
      searchEngine.rebuildIndex();
    } catch (err) {
      const duration = Date.now() - this.runStartTime;
      const message = err instanceof Error ? err.message : String(err);

      if (this.currentRunId !== null) {
        failIndexingRun(this.currentRunId, duration, message);
      }
      setIndexingStatus('error', message);
    } finally {
      unsubscribe();
      this.currentRunId = null;
    }
  }

  rebuildIndex(): Promise<void> {
    return this.startIndexing();
  }

  deleteIndex(): void {
    deleteAllPostings();
    deleteAllFiles();
    deleteAllTerms();
    resetIndexMetadata();
    searchEngine.rebuildIndex();
  }

  getStatus(): IndexState {
    const metadata = getIndexMetadata();
    const progress = indexerProgress.getProgress();

    return {
      status: metadata.status,
      currentFile: progress.currentFile ?? null,
      processed: progress.processed,
      total: progress.total,
      indexedFiles: getFileCount(),
      error: metadata.error_message ?? null,
    };
  }

  getStatistics(): IndexStatistics {
    const metadata = getIndexMetadata();
    const dbPath = getDatabasePath();
    let dbSize = 0;
    try {
      dbSize = fs.statSync(dbPath).size;
    } catch {
      dbSize = 0;
    }

    return {
      status: metadata.status,
      totalIndexedFiles: getFileCount(),
      totalIndexedFolders: getFolders().length,
      totalUniqueTerms: getTermCount(),
      lastIndexedAt: metadata.last_indexed_at,
      lastIndexDurationMs: metadata.last_index_duration_ms,
      averageIndexDurationMs: metadata.average_index_duration_ms,
      databaseSizeBytes: dbSize,
      totalIndexingRuns: metadata.total_indexing_runs,
    };
  }

  private handleProgress(progress: IndexingProgress): void {
    if (progress.status === 'error') {
      const duration = Date.now() - this.runStartTime;
      const message = progress.error ?? 'Unknown error';
      if (this.currentRunId !== null) {
        failIndexingRun(this.currentRunId, duration, message);
      }
      setIndexingStatus('error', message);
    }
  }
}

export const indexManager = new IndexManager();
