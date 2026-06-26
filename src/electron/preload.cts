const electron = require('electron');

electron.contextBridge.exposeInMainWorld('electron', {
  addFolder: (input) => ipcInvoke('addFolder', input),
  removeFolder: (input) => ipcInvoke('removeFolder', input),
  getFolders: () => ipcInvoke('getFolders'),
  setFolderEnabled: (input) => ipcInvoke('setFolderEnabled', input),
  startIndexing: () => ipcInvoke('startIndexing'),
  stopIndexing: () => ipcInvoke('stopIndexing'),
  getIndexingStatus: () => ipcInvoke('getIndexingStatus'),
  subscribeIndexingProgress: (callback) =>
    ipcOn('indexingProgress', (progress) => callback(progress)),
  getIndexStatus: () => ipcInvoke('getIndexStatus'),
  getIndexStatistics: () => ipcInvoke('getIndexStatistics'),
  deleteIndex: () => ipcInvoke('deleteIndex'),
  search: (input) => ipcInvoke('search', input),
  getAutocompleteSuggestions: (input) =>
    ipcInvoke('getAutocompleteSuggestions', input),
  openFile: (input) => ipcInvoke('openFile', input),
  openContainingFolder: (input) => ipcInvoke('openContainingFolder', input),
  selectFolder: () => ipcInvoke('selectFolder'),
  getSettings: () => ipcInvoke('getSettings'),
  setSetting: (input) => ipcInvoke('setSetting', input),
  getDuplicates: () => ipcInvoke('getDuplicates'),
  sendFrameAction: (payload) => ipcSend('sendFrameAction', payload),
} satisfies Window['electron']);

function ipcInvoke<Key extends keyof EventPayloadInputMapping>(
  key: Key,
  input?: EventPayloadInputMapping[Key]
): Promise<EventPayloadOutputMapping[Key]> {
  return electron.ipcRenderer.invoke(key, input);
}

function ipcOn<Key extends keyof EventPayloadInputMapping>(
  key: Key,
  callback: (payload: EventPayloadOutputMapping[Key]) => void
) {
  const cb = (_: Electron.IpcRendererEvent, payload: any) => callback(payload);
  electron.ipcRenderer.on(key, cb);
  return () => electron.ipcRenderer.off(key, cb);
}

function ipcSend<Key extends keyof EventPayloadInputMapping>(
  key: Key,
  payload: EventPayloadInputMapping[Key]
) {
  electron.ipcRenderer.send(key, payload);
}
