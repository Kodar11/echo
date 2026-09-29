import fs from 'fs';
import path from 'path';
import { app, BrowserWindow, dialog, nativeTheme, shell } from 'electron';
import { ipcMainHandle, ipcMainOn, ipcWebContentsSend, isDev } from './util.js';
import { getPreloadPath, getUIPath } from './pathResolver.js';
import { createMenu } from './menu.js';
import { closeDatabase } from '../database/connection.js';
import { getFilePathsUnder } from '../database/files.js';
import { getFolders } from '../database/folders.js';
import {
  getIndexingFailures,
  setIndexingFailureIgnored,
  type IndexingFailureRecord,
} from '../database/indexingFailures.js';
import { indexManager } from '../indexer/IndexManager.js';
import { IPC_CHANNELS } from '../ipc/channels.js';
import { searchEngine } from '../search/engine.js';
import { findDuplicateGroups } from '../search/duplicates.js';
import type { IgnoreRuleRecord } from '../services/ignore/IgnoreRuleManager.js';

let mainWindow: BrowserWindow | null = null;

/** Caption-button colors for the native title bar overlay, per theme. */
const TITLE_BAR_OVERLAY = {
  dark: { color: '#0e1013', symbolColor: '#a4abb5', height: 44 },
  light: { color: '#f6f7f9', symbolColor: '#505862', height: 44 },
} as const;

// The index lock and crash recovery assume a single process owns the
// database, so a second instance just focuses the first one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 720,
    minHeight: 520,
    titleBarStyle: 'hidden',
    // Native caption buttons (minimize / maximize / close, including Windows
    // Snap Layouts) drawn over the renderer's own title bar.
    titleBarOverlay:
      process.platform === 'darwin'
        ? undefined
        : TITLE_BAR_OVERLAY[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'],
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e1013' : '#f6f7f9',
    webPreferences: {
      preload: getPreloadPath(),
    },
  });

  if (isDev()) {
    mainWindow.loadURL('http://localhost:5123');
  } else {
    mainWindow.loadFile(getUIPath());
  }

  // Forward window state changes to the renderer for the custom title bar.
  const notifyWindowState = () => {
    if (!mainWindow) return;
    ipcWebContentsSend(
      IPC_CHANNELS.SUBSCRIBE_WINDOW_STATE,
      mainWindow.webContents,
      getWindowState(mainWindow)
    );
  };
  mainWindow.on('maximize', notifyWindowState);
  mainWindow.on('unmaximize', notifyWindowState);
  mainWindow.on('minimize', notifyWindowState);
  mainWindow.on('restore', notifyWindowState);
  mainWindow.on('enter-full-screen', notifyWindowState);
  mainWindow.on('leave-full-screen', notifyWindowState);

  // Register IPC handlers before any potentially slow initialization so the
  // renderer can query status as soon as it mounts.
  setupIpcHandlers();

  // Subscribe before initializing so the startup sync is reported too.
  indexManager.subscribeToProgress((progress) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    ipcWebContentsSend(
      IPC_CHANNELS.INDEXING_PROGRESS,
      mainWindow.webContents,
      progress
    );
  });

  indexManager.initialize();

  createMenu(mainWindow);
});

// Quit only after the indexing session (if any) has been cancelled and
// finalized, so no run is left "in progress" and the lock is released.
let shutdownComplete = false;
app.on('before-quit', (event) => {
  if (shutdownComplete) return;
  event.preventDefault();
  indexManager
    .dispose()
    .catch((err) => console.error('Shutdown cleanup failed:', err))
    .finally(() => {
      closeDatabase();
      shutdownComplete = true;
      app.quit();
    });
});

function setupIpcHandlers() {
  ipcMainHandle(IPC_CHANNELS.ADD_FOLDER, ({ path: folderPath }) => {
    const resolved = path.resolve(folderPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Folder does not exist: ${folderPath}`);
    }
    if (!fs.statSync(resolved).isDirectory()) {
      throw new Error(`Path is not a directory: ${folderPath}`);
    }
    // Adding a folder starts indexing it right away.
    return indexManager.addFolder(resolved);
  });

  ipcMainHandle(IPC_CHANNELS.REMOVE_FOLDER, ({ id }) => {
    indexManager.removeFolder(id);
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.GET_FOLDERS, () => {
    return getFolders().map((folder) => ({
      id: folder.id,
      path: folder.path,
      enabled: folder.enabled,
      lastSyncedAt: folder.last_synced_at,
      fileCount: getFilePathsUnder(folder.path).length,
    }));
  });

  ipcMainHandle(IPC_CHANNELS.SET_FOLDER_ENABLED, ({ id, enabled }) => {
    const folder = indexManager.setFolderEnabled(id, enabled);
    if (!folder) {
      throw new Error(`Folder ${id} not found`);
    }
    return folder;
  });

  // Returns as soon as the session is started (or joined); completion and
  // progress are reported through INDEXING_PROGRESS events.
  ipcMainHandle(IPC_CHANNELS.START_INDEXING, () => {
    void indexManager.startIndexing('manual');
    return undefined;
  });

  // Resolves once cancellation has been fully finalized.
  ipcMainHandle(IPC_CHANNELS.STOP_INDEXING, async () => {
    await indexManager.stopIndexing();
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.GET_INDEXING_STATUS, () => {
    return indexManager.getProgress();
  });

  ipcMainHandle(IPC_CHANNELS.GET_INDEX_STATUS, () => {
    return indexManager.getStatus();
  });

  ipcMainHandle(IPC_CHANNELS.GET_INDEX_STATISTICS, () => {
    return indexManager.getStatistics();
  });

  ipcMainHandle(IPC_CHANNELS.GET_HEALTH_STATS, () => {
    return indexManager.getHealthStats();
  });

  ipcMainHandle(IPC_CHANNELS.DELETE_INDEX, async () => {
    await indexManager.deleteIndex();
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.RESET_DATABASE, async () => {
    await indexManager.resetDatabase();
    return undefined;
  });

  // Only the most recent search may finish; an older one still generating
  // snippets stops and reports `cancelled` instead of overwriting results.
  let latestSearch = 0;
  ipcMainHandle(IPC_CHANNELS.SEARCH, async (options) => {
    const searchId = ++latestSearch;
    return searchEngine.search(options, () => searchId !== latestSearch);
  });

  ipcMainHandle(IPC_CHANNELS.GET_AUTOCOMPLETE_SUGGESTIONS, ({ prefix }) => {
    return searchEngine.getSuggestions(prefix, 10);
  });

  ipcMainHandle(IPC_CHANNELS.OPEN_FILE, async ({ path: filePath }) => {
    const error = await shell.openPath(filePath);
    if (error) {
      throw new Error(`Could not open file: ${error}`);
    }
    return undefined;
  });

  ipcMainHandle(
    IPC_CHANNELS.OPEN_CONTAINING_FOLDER,
    async ({ path: filePath }) => {
      shell.showItemInFolder(filePath);
      return undefined;
    }
  );

  ipcMainHandle(IPC_CHANNELS.SELECT_FOLDER, async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.canceled || result.filePaths.length === 0
      ? null
      : result.filePaths[0];
  });

  ipcMainHandle(IPC_CHANNELS.SELECT_FILE, async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Zip files', extensions: ['zip'] }],
    });
    return result.canceled || result.filePaths.length === 0
      ? null
      : result.filePaths[0];
  });

  ipcMainHandle(IPC_CHANNELS.GET_SETTINGS, () => {
    return buildSettings();
  });

  ipcMainHandle(IPC_CHANNELS.SET_SETTING, ({ key, value }) => {
    applySetting(key, value);
    return buildSettings();
  });

  ipcMainHandle(IPC_CHANNELS.GET_DUPLICATES, () => {
    return findDuplicateGroups();
  });

  ipcMainHandle(IPC_CHANNELS.GET_INDEXING_FAILURES, () => {
    return getIndexingFailures(false).map(mapFailureRecord);
  });

  ipcMainHandle(IPC_CHANNELS.RETRY_INDEXING_FAILURE, ({ path: failedPath }) => {
    indexManager.retryFailure(failedPath);
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.IGNORE_INDEXING_FAILURE, ({ path, ignored }) => {
    setIndexingFailureIgnored(path, ignored);
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.GET_IGNORE_RULES, () => {
    return indexManager.getIgnoreRules().map(mapIgnoreRuleRecord);
  });

  ipcMainHandle(IPC_CHANNELS.ADD_IGNORE_RULE, ({ pattern, type }) => {
    return mapIgnoreRuleRecord(indexManager.addIgnoreRule(pattern, type));
  });

  ipcMainHandle(IPC_CHANNELS.SET_IGNORE_RULE_ENABLED, ({ id, enabled }) => {
    indexManager.setIgnoreRuleEnabled(id, enabled);
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.DELETE_IGNORE_RULE, ({ id }) => {
    indexManager.deleteIgnoreRule(id);
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.EXPORT_BACKUP, async ({ destinationPath }) => {
    await indexManager.exportBackup(destinationPath);
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.IMPORT_BACKUP, async ({ sourcePath }) => {
    await indexManager.importBackup(sourcePath);
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.VALIDATE_BACKUP, async ({ sourcePath }) => {
    return indexManager.validateBackup(sourcePath);
  });

  ipcMainHandle(IPC_CHANNELS.OPEN_LOG_FOLDER, async () => {
    const logDir = indexManager.getLogDir();
    await shell.openPath(logDir);
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.GET_RECOVERY_RESULT, () => {
    return indexManager.getRecoveryResult();
  });

  ipcMainHandle(IPC_CHANNELS.CLEAR_RECOVERY_RESULT, () => {
    indexManager.clearRecoveryResult();
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.VERIFY_INDEX, () => {
    return indexManager.verifyIndex();
  });

  ipcMainHandle(IPC_CHANNELS.REPAIR_INDEX, async () => {
    return indexManager.repairIndex();
  });

  ipcMainHandle(IPC_CHANNELS.RUN_MAINTENANCE, async (options) => {
    return indexManager.runMaintenance(options ?? {});
  });

  ipcMainOn(IPC_CHANNELS.SEND_FRAME_ACTION, (payload) => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (!mainWindow) return;
    switch (payload) {
      case 'CLOSE':
        mainWindow.close();
        break;
      case 'MAXIMIZE':
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        break;
      case 'MINIMIZE':
        mainWindow.minimize();
        break;
    }
  });

  ipcMainOn(IPC_CHANNELS.SET_TITLE_BAR_THEME, (theme) => {
    if (!mainWindow || mainWindow.isDestroyed() || process.platform === 'darwin') return;
    const overlay = TITLE_BAR_OVERLAY[theme === 'light' ? 'light' : 'dark'];
    try {
      mainWindow.setTitleBarOverlay(overlay);
      mainWindow.setBackgroundColor(overlay.color);
    } catch {
      // Title bar overlays are unsupported on some platforms.
    }
  });

  ipcMainHandle(IPC_CHANNELS.GET_WINDOW_STATE, () => {
    const win = BrowserWindow.getFocusedWindow();
    return win ? getWindowState(win) : { isMaximized: false, isMinimized: false, isFullScreen: false };
  });
}

function getWindowState(win: BrowserWindow): WindowState {
  return {
    isMaximized: win.isMaximized(),
    isMinimized: win.isMinimized(),
    isFullScreen: win.isFullScreen(),
  };
}

function buildSettings(): AppSettings {
  return {
    autoSyncOnStartup: indexManager.getAutoSyncOnStartup(),
    enableWatchers: indexManager.getEnableWatchers(),
    removeStopWords: indexManager.getRemoveStopWords(),
    enableStemming: indexManager.getEnableStemming(),
    enableLanguageDetection: indexManager.getEnableLanguageDetection(),
    indexMetadata: indexManager.getIndexMetadata(),
    maxFileSizeBytes: indexManager.getMaxFileSizeBytes(),
    enabledExtractors: indexManager.getEnabledExtractors(),
    indexingMode: indexManager.getIndexingMode(),
    scheduleInterval: indexManager.getScheduleInterval(),
    enableIndexLogging: indexManager.getEnableIndexLogging(),
    enableWatcherLogging: indexManager.getEnableWatcherLogging(),
    enableErrorLogging: indexManager.getEnableErrorLogging(),
    enableDebugLogging: indexManager.getEnableDebugLogging(),
    autoRecovery: indexManager.getAutoRecovery(),
    transactionLogging: indexManager.getTransactionLogging(),
    automaticMaintenance: indexManager.getAutomaticMaintenance(),
    migrationBehavior: indexManager.getMigrationBehavior(),
    recoveryBehavior: indexManager.getRecoveryBehavior(),
    enableIntegrityCheckOnStartup: indexManager.getEnableIntegrityCheckOnStartup(),
    themePreference: indexManager.getThemePreference(),
    sidebarCollapsed: indexManager.getSidebarCollapsed(),
  };
}

function applySetting(
  key: keyof AppSettings,
  value: boolean | string | number | ExtractorId[]
): void {
  switch (key) {
    case 'autoSyncOnStartup':
      indexManager.setAutoSyncOnStartup(Boolean(value));
      break;
    case 'enableWatchers':
      indexManager.setEnableWatchers(Boolean(value));
      break;
    case 'removeStopWords':
      indexManager.setRemoveStopWords(Boolean(value));
      break;
    case 'enableStemming':
      indexManager.setEnableStemming(Boolean(value));
      break;
    case 'enableLanguageDetection':
      indexManager.setEnableLanguageDetection(Boolean(value));
      break;
    case 'indexMetadata':
      indexManager.setIndexMetadata(Boolean(value));
      break;
    case 'maxFileSizeBytes':
      indexManager.setMaxFileSizeBytes(Number(value));
      break;
    case 'enabledExtractors':
      indexManager.setEnabledExtractors(value as ExtractorId[]);
      break;
    case 'indexingMode':
      indexManager.setIndexingMode(value as IndexingMode);
      break;
    case 'scheduleInterval':
      indexManager.setScheduleInterval(value as ScheduleInterval);
      break;
    case 'enableIndexLogging':
      indexManager.setEnableIndexLogging(Boolean(value));
      break;
    case 'enableWatcherLogging':
      indexManager.setEnableWatcherLogging(Boolean(value));
      break;
    case 'enableErrorLogging':
      indexManager.setEnableErrorLogging(Boolean(value));
      break;
    case 'enableDebugLogging':
      indexManager.setEnableDebugLogging(Boolean(value));
      break;
    case 'autoRecovery':
      indexManager.setAutoRecovery(Boolean(value));
      break;
    case 'transactionLogging':
      indexManager.setTransactionLogging(Boolean(value));
      break;
    case 'automaticMaintenance':
      indexManager.setAutomaticMaintenance(Boolean(value));
      break;
    case 'migrationBehavior':
      indexManager.setMigrationBehavior(value as 'auto' | 'prompt' | 'block');
      break;
    case 'recoveryBehavior':
      indexManager.setRecoveryBehavior(value as 'auto' | 'notify' | 'manual');
      break;
    case 'enableIntegrityCheckOnStartup':
      indexManager.setEnableIntegrityCheckOnStartup(Boolean(value));
      break;
    case 'themePreference':
      indexManager.setThemePreference(value as 'system' | 'light' | 'dark');
      break;
    case 'sidebarCollapsed':
      indexManager.setSidebarCollapsed(Boolean(value));
      break;
  }
}

function mapFailureRecord(record: IndexingFailureRecord): IndexingFailure {
  return {
    id: record.id,
    path: record.path,
    category: record.category,
    message: record.message,
    occurredAt: record.occurred_at,
    retryCount: record.retry_count,
    ignored: record.ignored === 1,
  };
}

function mapIgnoreRuleRecord(record: IgnoreRuleRecord): IgnoreRule {
  return {
    id: record.id,
    pattern: record.pattern,
    type: record.type,
    enabled: record.enabled === 1,
    createdAt: record.created_at,
  };
}
