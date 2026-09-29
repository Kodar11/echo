import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import {
  getDatabase,
  getDatabasePath,
  getLastOpenReport,
  resetDatabase as resetDatabaseFile,
} from '../database/connection.js';
import { getFileCount, getFilePathsUnder } from '../database/files.js';
import {
  addFolder as addFolderRecord,
  getEnabledFolders,
  getFolderById,
  getFolders,
  getUnsyncedEnabledFolders,
  removeFolder as removeFolderRecord,
  setFolderEnabled as setFolderEnabledRecord,
  type FolderRecord,
} from '../database/folders.js';
import { clearIndexData } from '../database/indexWriter.js';
import { getIndexMetadata, resetIndexMetadata, type IndexStatus } from '../database/indexMetadata.js';
import { clearIndexingFailure } from '../database/indexingFailures.js';
import {
  getBooleanSetting,
  getSetting,
  setBooleanSetting,
  setSetting,
} from '../database/settings.js';
import { getTermCount } from '../database/terms.js';
import { SETTING_KEYS } from '../settings/keys.js';
import { searchEngine } from '../search/engine.js';
import { backupManager } from '../services/backup/BackupManager.js';
import { extractorManager, type ExtractorId } from '../services/extractors/ExtractorManager.js';
import { healthManager, type HealthStats } from '../services/health/HealthManager.js';
import {
  ignoreRuleManager,
  type IgnoreRuleRecord,
  type IgnoreRuleType,
} from '../services/ignore/IgnoreRuleManager.js';
import { createLogger, getLogger } from '../services/logger/logger.js';
import { ScheduleManager, type IndexingMode, type ScheduleInterval } from '../services/scheduler/ScheduleManager.js';
import { RecoveryManager, type RecoveryResultRecord } from '../services/recovery/RecoveryManager.js';
import { IntegrityManager } from '../services/integrity/IntegrityManager.js';
import { MaintenanceManager } from '../services/maintenance/MaintenanceManager.js';
import { errorMessage } from './errors.js';
import { isIndexConfigStale } from './indexingSettings.js';
import {
  IndexingCoordinator,
  type IndexingPhase,
  type IndexingState,
  type SessionResult,
  type SessionTrigger,
} from './IndexingCoordinator.js';
import { normalizeFsPath } from './paths.js';
import { WatcherManager } from './WatcherManager.js';

export type { IndexStatus };

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

export interface IndexStateRecord {
  status: IndexStatus;
  phase: IndexingPhase;
  currentFile: string | null;
  processed: number;
  total: number;
  indexedFiles: number;
  queueLength: number;
  error: string | null;
  lastRunStatus: SessionResult['outcome'] | null;
  lastRunFailed: number;
}

export interface IndexingProgressRecord {
  status: 'idle' | 'running';
  phase: IndexingPhase;
  trigger: SessionTrigger | null;
  currentFile?: string;
  processed: number;
  total: number;
  indexedFiles: number;
  failedTasks: number;
  pendingTasks: number;
  error?: string;
  lastOutcome: SessionResult['outcome'] | null;
}

const STARTUP_SYNC_DELAY_MS = 1000;

export class IndexManager {
  private readonly coordinator: IndexingCoordinator;
  private readonly watcherManager: WatcherManager;
  private readonly scheduleManager: ScheduleManager;
  private readonly recoveryManager = new RecoveryManager();
  private readonly integrityManager = new IntegrityManager();
  private readonly maintenanceManager = new MaintenanceManager();
  private recoveryResult: RecoveryResultRecord | null = null;
  private loggerInitialized = false;
  private initialized = false;
  private disposed = false;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // No database access here: the module is imported before the app is ready.
    this.coordinator = new IndexingCoordinator();
    this.watcherManager = new WatcherManager({
      onTasks: (tasks) => {
        this.coordinator.requestIncremental(tasks, 'watcher')?.catch((err) => this.logSessionError(err));
      },
      onDirectoryRemoved: (dirPath) => {
        const tasks = getFilePathsUnder(dirPath).map((filePath) => ({
          type: 'delete' as const,
          path: filePath,
        }));
        this.coordinator.requestIncremental(tasks, 'watcher')?.catch((err) => this.logSessionError(err));
      },
    });
    this.scheduleManager = new ScheduleManager({
      onStartupSync: () => this.requestSync('scheduled').then(() => undefined),
    });
  }

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.initializeLogger();

    // Opening the database validates the schema; an incompatible database is
    // rebuilt from scratch (see database/connection.ts).
    getDatabase();
    const openReport = getLastOpenReport();
    if (openReport && openReport.action !== 'opened') {
      getLogger().warn(
        'index',
        'IndexManager',
        `Database ${openReport.action} (schema v${openReport.schemaVersion})${openReport.reason ? `: ${openReport.reason}` : ''}`
      );
    }

    extractorManager.initialize();
    ignoreRuleManager.initialize();

    this.recoveryResult = this.recoveryManager.checkAndRecover(this.getAutoRecovery());

    if (this.getEnableIntegrityCheckOnStartup()) {
      const report = this.integrityManager.verify();
      if (!report.healthy) {
        getLogger().warn(
          'index',
          'IndexManager',
          `Startup integrity check found issues: ${JSON.stringify(report.summary)}`
        );
      }
    }

    searchEngine.rebuildIndex();
    this.syncWatchers();

    if (this.shouldRunStartupSync()) {
      this.startupTimer = setTimeout(() => {
        this.startupTimer = null;
        void this.requestSync('startup');
      }, STARTUP_SYNC_DELAY_MS);
    }

    this.scheduleManager.start();
  }

  /** Cancels any running session and waits for it to be finalized. */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.scheduleManager.stop();
    this.watcherManager.stop(false);
    await this.coordinator.dispose();
    getLogger().close();
  }

  private initializeLogger(): void {
    if (this.loggerInitialized) return;
    const logDir = path.join(app.getPath('userData'), 'echo', 'logs');
    createLogger({
      logDir,
      enabledCategories: {
        index: getBooleanSetting(SETTING_KEYS.enableIndexLogging, true),
        watcher: getBooleanSetting(SETTING_KEYS.enableWatcherLogging, true),
        errors: getBooleanSetting(SETTING_KEYS.enableErrorLogging, true),
        debug: getBooleanSetting(SETTING_KEYS.enableDebugLogging, false),
      },
    });
    this.loggerInitialized = true;
  }

  refreshLogger(): void {
    getLogger().setEnabledCategories({
      index: this.getEnableIndexLogging(),
      watcher: this.getEnableWatcherLogging(),
      errors: this.getEnableErrorLogging(),
      debug: this.getEnableDebugLogging(),
    });
  }

  // ---------------------------------------------------------------------
  // Sessions

  /**
   * Startup sync runs when the configured mode asks for it, or regardless of
   * mode when the disk state of an enabled folder was never reconciled, the
   * previous session was interrupted, or the indexing configuration changed.
   * A synchronized folder produces a zero-work sync, not a re-index.
   */
  private shouldRunStartupSync(): boolean {
    if (getEnabledFolders().length === 0) return false;
    return (
      this.scheduleManager.shouldRunStartupSync() ||
      getUnsyncedEnabledFolders().length > 0 ||
      Boolean(this.recoveryResult?.recovered) ||
      isIndexConfigStale()
    );
  }

  private requestSync(
    trigger: SessionTrigger,
    options: { afterCurrent?: boolean; force?: boolean } = {}
  ): Promise<SessionResult | null> {
    if (this.disposed) return Promise.resolve(null);
    return this.coordinator.requestFullSync(trigger, options).catch((err) => {
      this.logSessionError(err);
      return null;
    });
  }

  private logSessionError(err: unknown): void {
    getLogger().error('index', 'IndexManager', `Indexing session error: ${errorMessage(err)}`);
  }

  /** Starts (or joins) a full sync. Resolves when it has been finalized. */
  startIndexing(trigger: SessionTrigger = 'manual'): Promise<SessionResult | null> {
    return this.requestSync(trigger);
  }

  /** Cancels the running session; resolves once cleanup has completed. */
  async stopIndexing(): Promise<SessionResult | null> {
    return this.coordinator.cancel();
  }

  /** Re-attempts one failed file. */
  retryFailure(filePath: string): void {
    clearIndexingFailure(filePath);
    this.coordinator
      .requestIncremental([{ type: 'index', path: filePath }], 'retry')
      ?.catch((err) => this.logSessionError(err));
  }

  /** Deletes all indexed content but keeps folders and settings. */
  async deleteIndex(): Promise<void> {
    await this.coordinator.cancel();
    clearIndexData();
    resetIndexMetadata();
    searchEngine.rebuildIndex();
  }

  /**
   * Deliberate full reset: discards the database file (index, folders,
   * settings, rules) and recreates an empty database from the schema.
   */
  async resetDatabase(): Promise<void> {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    this.watcherManager.stop(false);
    await this.coordinator.cancel();
    resetDatabaseFile();
    extractorManager.initialize();
    ignoreRuleManager.initialize();
    searchEngine.rebuildIndex();
    this.syncWatchers();
    getLogger().warn('index', 'IndexManager', 'Database was reset to an empty state');
  }

  getStatus(): IndexStateRecord {
    const metadata = getIndexMetadata();
    const state = this.coordinator.getState();
    const last = state.lastResult;
    return {
      status: state.active ? 'indexing' : metadata.status,
      phase: state.phase,
      currentFile: state.queue.currentFile ?? null,
      processed: state.queue.processed,
      total: state.queue.total,
      indexedFiles: getFileCount(),
      queueLength: state.queue.pendingTasks,
      error: metadata.error_message ?? null,
      lastRunStatus: last?.outcome ?? metadata.last_run_status ?? null,
      lastRunFailed: last?.counts.failed ?? 0,
    };
  }

  getProgress(): IndexingProgressRecord {
    return toProgress(this.coordinator.getState());
  }

  subscribeToProgress(callback: (progress: IndexingProgressRecord) => void): () => void {
    return this.coordinator.subscribe((state) => callback(toProgress(state)));
  }

  getStatistics(): IndexStatistics {
    const metadata = getIndexMetadata();
    return {
      status: this.coordinator.isActive() ? 'indexing' : metadata.status,
      totalIndexedFiles: getFileCount(),
      totalIndexedFolders: getFolders().length,
      totalUniqueTerms: getTermCount(),
      lastIndexedAt: metadata.last_indexed_at,
      lastIndexDurationMs: metadata.last_index_duration_ms,
      averageIndexDurationMs: metadata.average_index_duration_ms,
      databaseSizeBytes: databaseSize(),
      totalIndexingRuns: metadata.total_indexing_runs,
    };
  }

  getHealthStats(): HealthStats {
    const state = this.coordinator.getState();
    return healthManager.getHealthStats(state.queue.pendingTasks, state.active);
  }

  // ---------------------------------------------------------------------
  // Folders

  addFolder(folderPath: string): FolderRecord {
    const folder = addFolderRecord(normalizeFsPath(folderPath));
    this.onFoldersChanged();
    return folder;
  }

  removeFolder(id: number): void {
    removeFolderRecord(id);
    // The sync deletes indexed files that are no longer under an enabled folder.
    this.onFoldersChanged();
  }

  setFolderEnabled(id: number, enabled: boolean): FolderRecord | undefined {
    const folder = setFolderEnabledRecord(id, enabled);
    if (folder) this.onFoldersChanged();
    return folder;
  }

  getFolder(id: number): FolderRecord | undefined {
    return getFolderById(id);
  }

  private onFoldersChanged(): void {
    this.syncWatchers();
    void this.requestSync('folders', { afterCurrent: true });
  }

  /** Makes the watcher state match the indexing mode and enabled folders. */
  private syncWatchers(): void {
    const folders = getEnabledFolders();
    if (!this.disposed && this.scheduleManager.shouldEnableWatchers() && folders.length > 0) {
      this.watcherManager.start(folders);
    } else {
      this.watcherManager.stop();
    }
  }

  restartWatchers(): void {
    this.syncWatchers();
  }

  // ---------------------------------------------------------------------
  // Settings

  getAutoSyncOnStartup(): boolean {
    return this.scheduleManager.shouldRunStartupSync();
  }

  setAutoSyncOnStartup(enabled: boolean): void {
    this.scheduleManager.setIndexingMode(enabled ? 'immediate' : 'manual');
    this.applyScheduleMode();
  }

  getEnableWatchers(): boolean {
    return this.scheduleManager.shouldEnableWatchers();
  }

  setEnableWatchers(enabled: boolean): void {
    this.scheduleManager.setIndexingMode(enabled ? 'immediate' : 'manual');
    this.applyScheduleMode();
  }

  getIndexingMode(): IndexingMode {
    return this.scheduleManager.getIndexingMode();
  }

  setIndexingMode(mode: IndexingMode): void {
    const changed = this.scheduleManager.getIndexingMode() !== mode;
    this.scheduleManager.setIndexingMode(mode);
    if (changed) this.applyScheduleMode();
  }

  getScheduleInterval(): ScheduleInterval {
    return this.scheduleManager.getScheduleInterval();
  }

  setScheduleInterval(interval: ScheduleInterval): void {
    this.scheduleManager.setScheduleInterval(interval);
    this.applyScheduleMode();
  }

  private applyScheduleMode(): void {
    this.scheduleManager.stop();
    this.syncWatchers();
    if (this.scheduleManager.getIndexingMode() === 'scheduled') {
      this.scheduleManager.start();
    }
  }

  getMaxFileSizeBytes(): number {
    const raw = getSetting(SETTING_KEYS.maxFileSizeBytes);
    const value = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  setMaxFileSizeBytes(bytes: number): void {
    const next = Number.isFinite(bytes) && bytes > 0 ? Math.floor(bytes) : 0;
    const changed = next !== this.getMaxFileSizeBytes();
    setSetting(SETTING_KEYS.maxFileSizeBytes, String(next));
    if (changed) this.onIndexingConfigChanged();
  }

  getEnabledExtractors(): ExtractorId[] {
    return extractorManager.getEnabled();
  }

  setEnabledExtractors(ids: ExtractorId[]): void {
    const changed =
      JSON.stringify([...extractorManager.getEnabled()].sort()) !== JSON.stringify([...ids].sort());
    extractorManager.setEnabled(ids);
    if (changed) this.onIndexingConfigChanged();
  }

  getRemoveStopWords(): boolean {
    return getBooleanSetting(SETTING_KEYS.removeStopWords, false);
  }

  setRemoveStopWords(enabled: boolean): void {
    const changed = this.getRemoveStopWords() !== enabled;
    setBooleanSetting(SETTING_KEYS.removeStopWords, enabled);
    if (changed) this.onIndexingConfigChanged();
  }

  getEnableStemming(): boolean {
    return getBooleanSetting(SETTING_KEYS.enableStemming, false);
  }

  setEnableStemming(enabled: boolean): void {
    const changed = this.getEnableStemming() !== enabled;
    setBooleanSetting(SETTING_KEYS.enableStemming, enabled);
    // Stemming is applied at query time; only the search tables change.
    if (changed) searchEngine.rebuildIndex();
  }

  getEnableLanguageDetection(): boolean {
    return getBooleanSetting(SETTING_KEYS.enableLanguageDetection, true);
  }

  setEnableLanguageDetection(enabled: boolean): void {
    const changed = this.getEnableLanguageDetection() !== enabled;
    setBooleanSetting(SETTING_KEYS.enableLanguageDetection, enabled);
    if (changed) this.onIndexingConfigChanged();
  }

  getIndexMetadata(): boolean {
    return getBooleanSetting(SETTING_KEYS.indexMetadata, true);
  }

  setIndexMetadata(enabled: boolean): void {
    const changed = this.getIndexMetadata() !== enabled;
    setBooleanSetting(SETTING_KEYS.indexMetadata, enabled);
    if (changed) this.onIndexingConfigChanged();
  }

  /**
   * Settings that change what is indexed trigger a sync after the current one.
   * Content-affecting settings change the index fingerprint, which makes that
   * sync re-index every file (see indexingSettings.ts).
   */
  private onIndexingConfigChanged(): void {
    if (getEnabledFolders().length === 0) return;
    void this.requestSync('settings', { afterCurrent: true });
  }

  getEnableIndexLogging(): boolean {
    return getBooleanSetting(SETTING_KEYS.enableIndexLogging, true);
  }

  setEnableIndexLogging(enabled: boolean): void {
    setBooleanSetting(SETTING_KEYS.enableIndexLogging, enabled);
    this.refreshLogger();
  }

  getEnableWatcherLogging(): boolean {
    return getBooleanSetting(SETTING_KEYS.enableWatcherLogging, true);
  }

  setEnableWatcherLogging(enabled: boolean): void {
    setBooleanSetting(SETTING_KEYS.enableWatcherLogging, enabled);
    this.refreshLogger();
  }

  getEnableErrorLogging(): boolean {
    return getBooleanSetting(SETTING_KEYS.enableErrorLogging, true);
  }

  setEnableErrorLogging(enabled: boolean): void {
    setBooleanSetting(SETTING_KEYS.enableErrorLogging, enabled);
    this.refreshLogger();
  }

  getEnableDebugLogging(): boolean {
    return getBooleanSetting(SETTING_KEYS.enableDebugLogging, false);
  }

  setEnableDebugLogging(enabled: boolean): void {
    setBooleanSetting(SETTING_KEYS.enableDebugLogging, enabled);
    this.refreshLogger();
  }

  getLogDir(): string {
    return getLogger().getLogDir();
  }

  // Ignore rules — every change re-evaluates which files belong in the index.
  getIgnoreRules(): IgnoreRuleRecord[] {
    return ignoreRuleManager.getRules();
  }

  addIgnoreRule(pattern: string, type: IgnoreRuleType = 'glob'): IgnoreRuleRecord {
    const rule = ignoreRuleManager.addRule(pattern, type);
    this.onIgnoreRulesChanged();
    return rule;
  }

  setIgnoreRuleEnabled(id: number, enabled: boolean): void {
    ignoreRuleManager.setEnabled(id, enabled);
    this.onIgnoreRulesChanged();
  }

  deleteIgnoreRule(id: number): void {
    ignoreRuleManager.deleteRule(id);
    this.onIgnoreRulesChanged();
  }

  private onIgnoreRulesChanged(): void {
    this.syncWatchers();
    this.onIndexingConfigChanged();
  }

  // Backup
  async exportBackup(destinationPath: string): Promise<void> {
    return backupManager.exportBackup(destinationPath);
  }

  async importBackup(sourcePath: string): Promise<void> {
    this.watcherManager.stop(false);
    await this.coordinator.cancel();
    try {
      await backupManager.importBackup(sourcePath);
    } finally {
      extractorManager.initialize();
      ignoreRuleManager.initialize();
      this.recoveryResult = this.recoveryManager.checkAndRecover(this.getAutoRecovery());
      searchEngine.rebuildIndex();
      this.syncWatchers();
    }
  }

  async validateBackup(sourcePath: string): Promise<{ valid: boolean; error?: string }> {
    return backupManager.validateBackup(sourcePath);
  }

  // Reliability
  getRecoveryResult(): RecoveryResultRecord | null {
    return this.recoveryResult;
  }

  clearRecoveryResult(): void {
    this.recoveryResult = null;
  }

  verifyIndex(): IntegrityReport {
    return this.integrityManager.verify();
  }

  async repairIndex(): Promise<IntegrityReport> {
    // Repairs must not race with index writes.
    await this.coordinator.cancel();
    const report = this.integrityManager.verifyAndRepair();
    searchEngine.rebuildIndex();
    return report;
  }

  runMaintenance(options?: { vacuum?: boolean; analyze?: boolean }): MaintenanceResult {
    return this.maintenanceManager.runMaintenance(options);
  }

  getAutoRecovery(): boolean {
    return getBooleanSetting(SETTING_KEYS.autoRecovery, true);
  }

  setAutoRecovery(enabled: boolean): void {
    setBooleanSetting(SETTING_KEYS.autoRecovery, enabled);
  }

  getTransactionLogging(): boolean {
    return getBooleanSetting(SETTING_KEYS.transactionLogging, false);
  }

  setTransactionLogging(enabled: boolean): void {
    setBooleanSetting(SETTING_KEYS.transactionLogging, enabled);
  }

  getAutomaticMaintenance(): boolean {
    return getBooleanSetting(SETTING_KEYS.automaticMaintenance, false);
  }

  setAutomaticMaintenance(enabled: boolean): void {
    setBooleanSetting(SETTING_KEYS.automaticMaintenance, enabled);
  }

  getMigrationBehavior(): 'auto' | 'prompt' | 'block' {
    const raw = getSetting(SETTING_KEYS.migrationBehavior, 'auto');
    if (raw === 'prompt' || raw === 'block') return raw;
    return 'auto';
  }

  setMigrationBehavior(value: 'auto' | 'prompt' | 'block'): void {
    setSetting(SETTING_KEYS.migrationBehavior, value);
  }

  getRecoveryBehavior(): 'auto' | 'notify' | 'manual' {
    const raw = getSetting(SETTING_KEYS.recoveryBehavior, 'auto');
    if (raw === 'notify' || raw === 'manual') return raw;
    return 'auto';
  }

  setRecoveryBehavior(value: 'auto' | 'notify' | 'manual'): void {
    setSetting(SETTING_KEYS.recoveryBehavior, value);
  }

  getEnableIntegrityCheckOnStartup(): boolean {
    return getBooleanSetting(SETTING_KEYS.enableIntegrityCheckOnStartup, true);
  }

  setEnableIntegrityCheckOnStartup(enabled: boolean): void {
    setBooleanSetting(SETTING_KEYS.enableIntegrityCheckOnStartup, enabled);
  }

  getThemePreference(): 'system' | 'light' | 'dark' {
    const raw = getSetting(SETTING_KEYS.themePreference, 'system');
    if (raw === 'light' || raw === 'dark') return raw;
    return 'system';
  }

  setThemePreference(value: 'system' | 'light' | 'dark'): void {
    setSetting(SETTING_KEYS.themePreference, value);
  }

  getSidebarCollapsed(): boolean {
    return getBooleanSetting(SETTING_KEYS.sidebarCollapsed, false);
  }

  setSidebarCollapsed(value: boolean): void {
    setBooleanSetting(SETTING_KEYS.sidebarCollapsed, value);
  }

  getOnboardingCompleted(): boolean {
    return getBooleanSetting(SETTING_KEYS.onboardingCompleted, false);
  }

  setOnboardingCompleted(value: boolean): void {
    setBooleanSetting(SETTING_KEYS.onboardingCompleted, value);
  }
}

function toProgress(state: IndexingState): IndexingProgressRecord {
  return {
    status: state.active ? 'running' : 'idle',
    phase: state.phase,
    trigger: state.trigger,
    currentFile: state.queue.currentFile,
    processed: state.queue.processed,
    total: state.queue.total,
    indexedFiles: state.queue.indexedFiles,
    failedTasks: state.queue.failedTasks,
    pendingTasks: state.queue.pendingTasks,
    error: state.lastResult?.error ?? undefined,
    lastOutcome: state.lastResult?.outcome ?? null,
  };
}

function databaseSize(): number {
  const dbPath = getDatabasePath();
  let total = 0;
  for (const suffix of ['', '-wal']) {
    try {
      total += fs.statSync(`${dbPath}${suffix}`).size;
    } catch {
      // Missing WAL file is normal.
    }
  }
  return total;
}

export const indexManager = new IndexManager();
