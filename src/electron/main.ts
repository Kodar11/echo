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
import { indexManager } from '../indexer/IndexManager.js';
import { IPC_CHANNELS } from '../ipc/channels.js';
import { searchEngine } from '../search/engine.js';
import { findDuplicateGroups } from '../search/duplicates.js';

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

  ipcMainHandle(IPC_CHANNELS.GET_SETTINGS, () => {
    return {
      autoSyncOnStartup: indexManager.getAutoSyncOnStartup(),
      enableWatchers: indexManager.getEnableWatchers(),
      removeStopWords: indexManager.getRemoveStopWords(),
      enableStemming: indexManager.getEnableStemming(),
      enableLanguageDetection: indexManager.getEnableLanguageDetection(),
      indexMetadata: indexManager.getIndexMetadata(),
    };
  });

  ipcMainHandle(IPC_CHANNELS.SET_SETTING, ({ key, value }) => {
    if (key === 'autoSyncOnStartup') {
      indexManager.setAutoSyncOnStartup(value);
    } else if (key === 'enableWatchers') {
      indexManager.setEnableWatchers(value);
    } else if (key === 'removeStopWords') {
      indexManager.setRemoveStopWords(value);
    } else if (key === 'enableStemming') {
      indexManager.setEnableStemming(value);
    } else if (key === 'enableLanguageDetection') {
      indexManager.setEnableLanguageDetection(value);
    } else if (key === 'indexMetadata') {
      indexManager.setIndexMetadata(value);
    }
    return {
      autoSyncOnStartup: indexManager.getAutoSyncOnStartup(),
      enableWatchers: indexManager.getEnableWatchers(),
      removeStopWords: indexManager.getRemoveStopWords(),
      enableStemming: indexManager.getEnableStemming(),
      enableLanguageDetection: indexManager.getEnableLanguageDetection(),
      indexMetadata: indexManager.getIndexMetadata(),
    };
  });

  ipcMainHandle(IPC_CHANNELS.GET_DUPLICATES, () => {
    return findDuplicateGroups();
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
