import fs from 'fs';
import path from 'path';
import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import { ipcMainHandle, ipcMainOn, ipcWebContentsSend, isDev } from './util.js';
import { getPreloadPath, getUIPath } from './pathResolver.js';
import { createMenu } from './menu.js';
import {
  addFolder,
  getFolderById,
  getFolders,
  removeFolder,
  setFolderEnabled,
} from '../database/folders.js';
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

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: getPreloadPath(),
    },
  });

  if (isDev()) {
    mainWindow.loadURL('http://localhost:5123');
  } else {
    mainWindow.loadFile(getUIPath());
  }

  // Register IPC handlers before any potentially slow initialization so the
  // renderer can query status as soon as it mounts.
  setupIpcHandlers();

  indexManager.initialize();

  // Forward queue progress to renderer
  indexManager.subscribeToProgress((progress) => {
    if (!mainWindow) return;
    ipcWebContentsSend(
      IPC_CHANNELS.INDEXING_PROGRESS,
      mainWindow.webContents,
      progress
    );
  });

  createMenu(mainWindow);
});

app.on('before-quit', () => {
  indexManager.dispose();
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
    const folder = addFolder(resolved);
    indexManager.restartWatchers();
    return folder;
  });

  ipcMainHandle(IPC_CHANNELS.REMOVE_FOLDER, ({ id }) => {
    const folder = getFolderById(id);
    if (folder) {
      indexManager.removeFolderFiles(folder.path);
    }
    removeFolder(id);
    indexManager.restartWatchers();
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.GET_FOLDERS, () => {
    return getFolders();
  });

  ipcMainHandle(IPC_CHANNELS.SET_FOLDER_ENABLED, ({ id, enabled }) => {
    const folder = setFolderEnabled(id, enabled);
    if (!folder) {
      throw new Error(`Folder ${id} not found`);
    }
    indexManager.restartWatchers();
    return folder;
  });

  ipcMainHandle(IPC_CHANNELS.START_INDEXING, async () => {
    await indexManager.startIndexing();
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.STOP_INDEXING, () => {
    indexManager.stopIndexing();
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.GET_INDEXING_STATUS, () => {
    return indexManager.getQueueProgress();
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

  ipcMainHandle(IPC_CHANNELS.DELETE_INDEX, () => {
    indexManager.deleteIndex();
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.SEARCH, async (options) => {
    return searchEngine.search(options);
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

  ipcMainHandle(IPC_CHANNELS.RETRY_INDEXING_FAILURE, async ({ path }) => {
    await indexManager.startIndexing();
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
    const rule = indexManager.addIgnoreRule(pattern, type);
    indexManager.restartWatchers();
    return mapIgnoreRuleRecord(rule);
  });

  ipcMainHandle(IPC_CHANNELS.SET_IGNORE_RULE_ENABLED, ({ id, enabled }) => {
    indexManager.setIgnoreRuleEnabled(id, enabled);
    indexManager.restartWatchers();
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.DELETE_IGNORE_RULE, ({ id }) => {
    indexManager.deleteIgnoreRule(id);
    indexManager.restartWatchers();
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
