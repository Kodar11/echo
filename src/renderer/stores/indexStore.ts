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
  resetDatabase: () => Promise<void>;
  loadProgress: () => Promise<void>;
  setProgress: (progress: IndexingProgress) => void;
}

const initialStatus: IndexState = {
  status: 'never_indexed',
  phase: 'idle',
  currentFile: null,
  processed: 0,
  total: 0,
  indexedFiles: 0,
  queueLength: 0,
  error: null,
  lastRunStatus: null,
  lastRunFailed: 0,
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
  phase: 'idle',
  trigger: null,
  processed: 0,
  total: 0,
  indexedFiles: 0,
  lastOutcome: null,
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
    // Returns once the session has started; progress events drive the UI.
    await window.electron.startIndexing();
    await get().loadStatus();
  },
  stopIndexing: async () => {
    // Resolves after the backend finished cancelling and cleaning up.
    await window.electron.stopIndexing();
    await get().loadStatus();
    await get().loadStatistics();
  },
  deleteIndex: async () => {
    await window.electron.deleteIndex();
    await get().loadStatus();
    await get().loadStatistics();
  },
  resetDatabase: async () => {
    await window.electron.resetDatabase();
    await get().loadStatus();
    await get().loadStatistics();
  },
  loadProgress: async () => {
    const progress = await window.electron.getIndexingStatus();
    get().setProgress(progress);
  },
  setProgress: (progress) => {
    const previous = get().progress;
    // Live fields come straight from the event; persisted fields (status,
    // last run outcome, counts) are reloaded when the phase changes.
    set((state) => ({
      progress,
      status: {
        ...state.status,
        status: progress.status === 'running' ? 'indexing' : state.status.status,
        phase: progress.phase,
        currentFile: progress.currentFile ?? null,
        processed: progress.processed,
        total: progress.total,
        queueLength: progress.pendingTasks ?? 0,
      },
    }));
    if (previous.phase !== progress.phase || previous.status !== progress.status) {
      void get().loadStatus();
      if (progress.status === 'idle') {
        void get().loadStatistics();
      }
    }
  },
}));
