import { create } from 'zustand';

interface IndexStoreState {
  status: IndexState;
  statistics: IndexStatistics;
  progress: IndexingProgress;
  loadStatus: () => Promise<void>;
  loadStatistics: () => Promise<void>;
  startIndexing: () => Promise<void>;
  stopIndexing: () => Promise<void>;
  deleteIndex: () => Promise<void>;
  loadProgress: () => Promise<void>;
  setProgress: (progress: IndexingProgress) => void;
}

const initialStatus: IndexState = {
  status: 'never_indexed',
  currentFile: null,
  processed: 0,
  total: 0,
  indexedFiles: 0,
  queueLength: 0,
  error: null,
};

const initialStatistics: IndexStatistics = {
  status: 'never_indexed',
  totalIndexedFiles: 0,
  totalIndexedFolders: 0,
  totalUniqueTerms: 0,
  lastIndexedAt: null,
  lastIndexDurationMs: null,
  averageIndexDurationMs: null,
  databaseSizeBytes: 0,
  totalIndexingRuns: 0,
};

const initialProgress: IndexingProgress = {
  status: 'idle',
  processed: 0,
  total: 0,
  indexedFiles: 0,
};

export const useIndexStore = create<IndexStoreState>((set, get) => ({
  status: initialStatus,
  statistics: initialStatistics,
  progress: initialProgress,
  loadStatus: async () => {
    const status = await window.electron.getIndexStatus();
    set({ status });
  },
  loadStatistics: async () => {
    const statistics = await window.electron.getIndexStatistics();
    set({ statistics });
  },
  startIndexing: async () => {
    await window.electron.startIndexing();
    await get().loadStatus();
    await get().loadStatistics();
  },
  stopIndexing: async () => {
    await window.electron.stopIndexing();
    await get().loadStatus();
    await get().loadStatistics();
  },
  deleteIndex: async () => {
    await window.electron.deleteIndex();
    await get().loadStatus();
    await get().loadStatistics();
  },
  loadProgress: async () => {
    const progress = await window.electron.getIndexingStatus();
    set({ progress });
  },
  setProgress: (progress) => {
    set({ progress });
    // Keep the live status (current file, processed/total, queue length) in sync
    // with every progress tick so the UI updates smoothly.
    get().loadStatus();
    if (progress.status === 'idle' || progress.status === 'error') {
      get().loadStatistics();
    }
  },
}));
