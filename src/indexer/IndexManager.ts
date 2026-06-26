import fs from 'fs';
import path from 'path';
import { getDatabasePath } from '../database/connection.js';
import {
  deleteAllFiles,
  getFileCount,
  getFilePathsByPrefix,
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
import { getBooleanSetting, setBooleanSetting } from '../database/settings.js';
import { deleteAllTerms, getTermCount } from '../database/terms.js';
import { SETTING_KEYS } from '../settings/keys.js';
import { searchEngine } from '../search/engine.js';
import {
  IndexQueue,
  type IndexQueueProgress,
  type ProgressCallback,
} from './IndexQueue.js';
import { SyncManager } from './SyncManager.js';
import { WatcherManager } from './WatcherManager.js';

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
  queueLength: number;
  error: string | null;
}

export class IndexManager {
  private queue: IndexQueue;
  private syncManager: SyncManager;
  private watcherManager: WatcherManager;
  private currentRunId: number | null = null;
  private runStartTime = 0;
  private manualRunInProgress = false;
  private engineNeedsRebuild = false;
  private lastRebuildTime = 0;
  private watchersStarted = false;
  private unsubscribeQueue?: () => void;

  constructor() {
    this.queue = new IndexQueue({
      onIdle: () => this.handleQueueIdle(),
    });
    this.syncManager = new SyncManager(this.queue);
    this.watcherManager = new WatcherManager(this.queue, this.syncManager);
  }

  initialize(): void {
    this.ensureMetadata();
    this.loadIndex();
    this.unsubscribeQueue = this.queue.subscribe((progress) => {
      this.handleQueueProgress(progress);
    });

    if (this.getAutoSyncOnStartup() && this.shouldRunStartupSync()) {
      this.runStartupSync();
    } else {
      if (this.getEnableWatchers()) {
        this.startWatchers();
      }
    }
  }

  dispose(): void {
    this.unsubscribeQueue?.();
    this.watcherManager.stop();
  }

  ensureMetadata(): void {
    getIndexMetadata();
  }

  loadIndex(): void {
    const metadata = getIndexMetadata();
    const fileCount = getFileCount();

    searchEngine.rebuildIndex();
    this.lastRebuildTime = Date.now();

    if (fileCount === 0) {
      if (metadata.status !== 'indexing' && metadata.status !== 'error') {
        setIndexingStatus('never_indexed');
      }
      return;
    }

    if (metadata.status !== 'indexing' && metadata.status !== 'error') {
      setIndexingStatus('indexed');
    }
  }

  async startIndexing(): Promise<void> {
    if (this.manualRunInProgress) return;

    this.stopWatchers();
    this.runStartTime = Date.now();
    this.currentRunId = startIndexingRun();
    this.manualRunInProgress = true;
    setIndexingStatus('indexing');

    await this.syncManager.sync({ trigger: 'manual' });
  }

  stopIndexing(): void {
    this.queue.clear();
    this.watcherManager.stop();

    if (this.manualRunInProgress && this.currentRunId !== null) {
      const duration = Date.now() - this.runStartTime;
      failIndexingRun(this.currentRunId, duration, 'Cancelled by user');
    }

    this.manualRunInProgress = false;
    this.currentRunId = null;
    this.engineNeedsRebuild = true;

    setIndexingStatus('indexed');
    this.rebuildSearchEngineIfNeeded(true);

    if (this.getEnableWatchers()) {
      this.startWatchers();
    }
  }

  deleteIndex(): void {
    this.stopWatchers();
    this.queue.clear();
    this.manualRunInProgress = false;
    this.currentRunId = null;
    this.engineNeedsRebuild = false;

    deleteAllPostings();
    deleteAllFiles();
    deleteAllTerms();
    resetIndexMetadata();
    searchEngine.rebuildIndex();
  }

  getStatus(): IndexState {
    const metadata = getIndexMetadata();
    const progress = this.queue.getProgress();

    return {
      status: metadata.status,
      currentFile: progress.currentFile ?? null,
      processed: progress.processed,
      total: progress.total,
      indexedFiles: getFileCount(),
      queueLength: progress.pendingTasks,
      error: metadata.error_message ?? null,
    };
  }

  subscribeToProgress(callback: ProgressCallback): () => void {
    return this.queue.subscribe(callback);
  }

  getQueueProgress(): IndexQueueProgress {
    return this.queue.getProgress();
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

  removeFolderFiles(folderPath: string): void {
    const prefix = folderPath.endsWith(path.sep)
      ? folderPath
      : `${folderPath}${path.sep}`;
    const files = getFilePathsByPrefix(prefix);
    if (files.length === 0) return;

    this.queue.enqueueMany(files.map((filePath) => ({
      type: 'delete' as const,
      path: filePath,
    })));
  }

  restartWatchers(): void {
    if (this.getEnableWatchers()) {
      this.startWatchers();
    }
  }

  getAutoSyncOnStartup(): boolean {
    return getBooleanSetting(SETTING_KEYS.autoSyncOnStartup, true);
  }

  setAutoSyncOnStartup(enabled: boolean): void {
    setBooleanSetting(SETTING_KEYS.autoSyncOnStartup, enabled);
  }

  getEnableWatchers(): boolean {
    return getBooleanSetting(SETTING_KEYS.enableWatchers, true);
  }

  setEnableWatchers(enabled: boolean): void {
    setBooleanSetting(SETTING_KEYS.enableWatchers, enabled);
    if (enabled) {
      this.startWatchers();
    } else {
      this.stopWatchers();
    }
  }

  getRemoveStopWords(): boolean {
    return getBooleanSetting(SETTING_KEYS.removeStopWords, false);
  }

  setRemoveStopWords(enabled: boolean): void {
    const changed = this.getRemoveStopWords() !== enabled;
    setBooleanSetting(SETTING_KEYS.removeStopWords, enabled);
    if (changed) {
      this.triggerReindex();
    }
  }

  getEnableStemming(): boolean {
    return getBooleanSetting(SETTING_KEYS.enableStemming, false);
  }

  setEnableStemming(enabled: boolean): void {
    const changed = this.getEnableStemming() !== enabled;
    setBooleanSetting(SETTING_KEYS.enableStemming, enabled);
    if (changed) {
      this.triggerReindex();
    }
  }

  getEnableLanguageDetection(): boolean {
    return getBooleanSetting(SETTING_KEYS.enableLanguageDetection, true);
  }

  setEnableLanguageDetection(enabled: boolean): void {
    const changed = this.getEnableLanguageDetection() !== enabled;
    setBooleanSetting(SETTING_KEYS.enableLanguageDetection, enabled);
    if (changed) {
      this.triggerReindex();
    }
  }

  getIndexMetadata(): boolean {
    return getBooleanSetting(SETTING_KEYS.indexMetadata, true);
  }

  setIndexMetadata(enabled: boolean): void {
    const changed = this.getIndexMetadata() !== enabled;
    setBooleanSetting(SETTING_KEYS.indexMetadata, enabled);
    if (changed) {
      this.triggerReindex();
    }
  }

  private triggerReindex(): void {
    // Schedule a full reindex so the existing index stays consistent with the
    // new language-processing settings.
    setTimeout(() => {
      this.startIndexing().catch((err) => {
        console.error('Auto-reindex failed:', err);
      });
    }, 100);
  }

  private shouldRunStartupSync(): boolean {
    const metadata = getIndexMetadata();
    if (metadata.status === 'indexing') return false;
    if (getFolders().length === 0) return false;
    if (getFileCount() === 0) return false;
    return true;
  }

  private runStartupSync(): void {
    // Defer startup sync slightly so the UI finishes loading.
    setTimeout(() => {
      this.syncManager.sync({ trigger: 'startup' }).catch((err) => {
        console.error('Startup sync failed:', err);
        setIndexingStatus('indexed');
        this.engineNeedsRebuild = true;
        this.rebuildSearchEngineIfNeeded(true);
        if (this.getEnableWatchers() && !this.watchersStarted) {
          this.startWatchers();
        }
      });
    }, 1000);
  }

  private startWatchers(): void {
    if (this.manualRunInProgress) return;
    this.watchersStarted = true;
    this.watcherManager.start(getFolders());
  }

  private stopWatchers(): void {
    this.watchersStarted = false;
    this.watcherManager.stop();
  }

  private handleQueueProgress(progress: IndexQueueProgress): void {
    if (progress.status === 'running') {
      setIndexingStatus('indexing');
    } else if (progress.status === 'error') {
      const duration = Date.now() - this.runStartTime;
      const message = progress.error ?? 'Unknown error';
      if (this.currentRunId !== null && this.manualRunInProgress) {
        failIndexingRun(this.currentRunId, duration, message);
      }
      setIndexingStatus('error', message);
      this.manualRunInProgress = false;
      this.currentRunId = null;

      this.engineNeedsRebuild = true;
      this.rebuildSearchEngineIfNeeded(true);

      if (this.getEnableWatchers() && !this.watchersStarted) {
        this.startWatchers();
      }
    }
  }

  private handleQueueIdle(): void {
    const wasManualRun = this.manualRunInProgress;

    if (this.manualRunInProgress && this.currentRunId !== null) {
      const duration = Date.now() - this.runStartTime;
      const fileCount = getFileCount();
      const termCount = getTermCount();

      completeIndexingRun(this.currentRunId, duration, fileCount);
      recordIndexingCompleted(duration, fileCount, termCount);
      this.manualRunInProgress = false;
      this.currentRunId = null;
    }

    // Mark indexing as done before any potentially slow rebuild so the UI
    // reflects the completed state immediately.
    setIndexingStatus('indexed');

    this.engineNeedsRebuild = true;
    this.rebuildSearchEngineIfNeeded(wasManualRun);

    if (this.getEnableWatchers() && !this.watchersStarted) {
      this.startWatchers();
    }
  }

  private rebuildSearchEngineIfNeeded(force = false): void {
    if (!this.engineNeedsRebuild) return;

    const throttleMs = 2000;
    if (!force && Date.now() - this.lastRebuildTime < throttleMs) {
      return;
    }

    searchEngine.rebuildIndex();
    this.engineNeedsRebuild = false;
    this.lastRebuildTime = Date.now();
  }
}

export const indexManager = new IndexManager();
