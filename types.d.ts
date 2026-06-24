type IndexedFolder = {
  id: number;
  path: string;
  enabled: number;
};

type IndexingProgress = {
  status: 'idle' | 'running' | 'completed' | 'error';
  currentFile?: string;
  processed: number;
  total: number;
  indexedFiles: number;
  error?: string;
};

type SearchResult = {
  fileId: number;
  path: string;
  filename: string;
  size: number;
  modifiedTime: number;
  score: number;
  snippet: string;
  matchedTerms: string[];
  phraseMatch: boolean;
};

type FrameWindowAction = 'CLOSE' | 'MAXIMIZE' | 'MINIMIZE';

type EventPayloadInputMapping = {
  addFolder: { path: string };
  removeFolder: { id: number };
  getFolders: void;
  setFolderEnabled: { id: number; enabled: boolean };
  startIndexing: void;
  getIndexingStatus: void;
  indexingProgress: IndexingProgress;
  search: { query: string };
  getAutocompleteSuggestions: { prefix: string };
  openFile: { path: string };
  sendFrameAction: FrameWindowAction;
};

type EventPayloadOutputMapping = {
  addFolder: IndexedFolder;
  removeFolder: void;
  getFolders: IndexedFolder[];
  setFolderEnabled: IndexedFolder;
  startIndexing: void;
  getIndexingStatus: IndexingProgress;
  indexingProgress: IndexingProgress;
  search: SearchResult[];
  getAutocompleteSuggestions: string[];
  openFile: void;
  sendFrameAction: void;
};

type UnsubscribeFunction = () => void;

interface Window {
  electron: {
    addFolder: (input: { path: string }) => Promise<IndexedFolder>;
    removeFolder: (input: { id: number }) => Promise<void>;
    getFolders: () => Promise<IndexedFolder[]>;
    setFolderEnabled: (input: {
      id: number;
      enabled: boolean;
    }) => Promise<IndexedFolder>;
    startIndexing: () => Promise<void>;
    getIndexingStatus: () => Promise<IndexingProgress>;
    subscribeIndexingProgress: (
      callback: (progress: IndexingProgress) => void
    ) => UnsubscribeFunction;
    search: (input: { query: string }) => Promise<SearchResult[]>;
    getAutocompleteSuggestions: (input: {
      prefix: string;
    }) => Promise<string[]>;
    openFile: (input: { path: string }) => Promise<void>;
    sendFrameAction: (payload: FrameWindowAction) => void;
  };
}
