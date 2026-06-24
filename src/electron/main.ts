import fs from 'fs';
import path from 'path';
import { app, BrowserWindow, Menu, shell } from 'electron';
import { ipcMainHandle, ipcMainOn, ipcWebContentsSend, isDev } from './util.js';
import { getPreloadPath, getUIPath } from './pathResolver.js';
import { createMenu } from './menu.js';
import {
  addFolder,
  getFolders,
  removeFolder,
  setFolderEnabled,
} from '../database/folders.js';
import { indexerProgress } from '../indexer/indexer.js';
import { indexManager } from '../indexer/IndexManager.js';
import { IPC_CHANNELS } from '../ipc/channels.js';
import { searchEngine } from '../search/engine.js';

app.on('ready', () => {
  const mainWindow = new BrowserWindow({
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

  indexManager.initialize();

  // Forward indexing progress to renderer
  indexerProgress.subscribe((progress) => {
    if (progress.status === 'completed') {
      searchEngine.rebuildIndex();
    }
    ipcWebContentsSend(IPC_CHANNELS.INDEXING_PROGRESS, mainWindow.webContents, progress);
  });

  setupIpcHandlers();
  createMenu(mainWindow);
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
    return folder;
  });

  ipcMainHandle(IPC_CHANNELS.REMOVE_FOLDER, ({ id }) => {
    removeFolder(id);
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
    return folder;
  });

  ipcMainHandle(IPC_CHANNELS.START_INDEXING, async () => {
    await indexManager.startIndexing();
    return undefined;
  });

  ipcMainHandle(IPC_CHANNELS.GET_INDEXING_STATUS, () => {
    return indexerProgress.getProgress();
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

  ipcMainHandle(IPC_CHANNELS.SEARCH, async ({ query }) => {
    return searchEngine.search(query);
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
