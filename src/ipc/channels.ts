export const IPC_CHANNELS = {
  ADD_FOLDER: 'addFolder',
  REMOVE_FOLDER: 'removeFolder',
  GET_FOLDERS: 'getFolders',
  SET_FOLDER_ENABLED: 'setFolderEnabled',
  START_INDEXING: 'startIndexing',
  GET_INDEXING_STATUS: 'getIndexingStatus',
  INDEXING_PROGRESS: 'indexingProgress',
  SEARCH: 'search',
  GET_AUTOCOMPLETE_SUGGESTIONS: 'getAutocompleteSuggestions',
  OPEN_FILE: 'openFile',
  SEND_FRAME_ACTION: 'sendFrameAction',
} as const;
