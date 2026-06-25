type IndexedFolder = {
  id: number;
  path: string;
  enabled: number;
};

type IndexStatus = 'never_indexed' | 'indexing' | 'indexed' | 'error';

type IndexState = {
  status: IndexStatus;
  currentFile: string | null;
  processed: number;
  total: number;
  indexedFiles: number;
  queueLength: number;
  error: string | null;
};

type IndexStatistics = {
  status: IndexStatus;
  totalIndexedFiles: number;
  totalIndexedFolders: number;
  totalUniqueTerms: number;
  lastIndexedAt: number | null;
  lastIndexDurationMs: number | null;
  averageIndexDurationMs: number | null;
  databaseSizeBytes: number;
  totalIndexingRuns: number;
};

type IndexingProgress = {
  status: 'idle' | 'running' | 'completed' | 'error';
  currentFile?: string;
  processed: number;
  total: number;
  indexedFiles: number;
  pendingTasks?: number;
  error?: string;
};

type SearchResult = {
  fileId: number;
  path: string;
  filename: string;
  size: number;
  modifiedTime: number;
  score: number;
  snippets: string[];
  matchedTerms: string[];
  phraseTerms: string[];
  phraseMatch: boolean;
};

type SearchOptions = {
  query: string;
  folderIds?: number[];
};

type SearchResponse = {
  results: SearchResult[];
  totalCount: number;
  durationMs: number;
};

type FrameWindowAction = 'CLOSE' | 'MAXIMIZE' | 'MINIMIZE';

type AppSettings = {
  autoSyncOnStartup: boolean;
  enableWatchers: boolean;
};

type EventPayloadInputMapping = {
  addFolder: { path: string };
  removeFolder: { id: number };
  getFolders: void;
  setFolderEnabled: { id: number; enabled: boolean };
  startIndexing: void;
  stopIndexing: void;
  getIndexingStatus: void;
  indexingProgress: IndexingProgress;
  getIndexStatus: void;
  getIndexStatistics: void;
  deleteIndex: void;
  search: SearchOptions;
  getAutocompleteSuggestions: { prefix: string };
  openFile: { path: string };
  openContainingFolder: { path: string };
  selectFolder: void;
  getSettings: void;
  setSetting: { key: keyof AppSettings; value: boolean };
  sendFrameAction: FrameWindowAction;
};

type EventPayloadOutputMapping = {
  addFolder: IndexedFolder;
  removeFolder: void;
  getFolders: IndexedFolder[];
  setFolderEnabled: IndexedFolder;
  startIndexing: void;
  stopIndexing: void;
  getIndexingStatus: IndexingProgress;
  indexingProgress: IndexingProgress;
  getIndexStatus: IndexState;
  getIndexStatistics: IndexStatistics;
  deleteIndex: void;
  search: SearchResponse;
  getAutocompleteSuggestions: string[];
  openFile: void;
  openContainingFolder: void;
  selectFolder: string | null;
  getSettings: AppSettings;
  setSetting: AppSettings;
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
    stopIndexing: () => Promise<void>;
    getIndexingStatus: () => Promise<IndexingProgress>;
    subscribeIndexingProgress: (
      callback: (progress: IndexingProgress) => void
    ) => UnsubscribeFunction;
    getIndexStatus: () => Promise<IndexState>;
    getIndexStatistics: () => Promise<IndexStatistics>;
    deleteIndex: () => Promise<void>;
    search: (input: SearchOptions) => Promise<SearchResponse>;
    getAutocompleteSuggestions: (input: {
      prefix: string;
    }) => Promise<string[]>;
    openFile: (input: { path: string }) => Promise<void>;
    openContainingFolder: (input: { path: string }) => Promise<void>;
    selectFolder: () => Promise<string | null>;
    getSettings: () => Promise<AppSettings>;
    setSetting: (input: {
      key: keyof AppSettings;
      value: boolean;
    }) => Promise<AppSettings>;
    sendFrameAction: (payload: FrameWindowAction) => void;
  };
}
