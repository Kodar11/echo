import { create } from 'zustand';

interface IndexState {
  progress: IndexingProgress;
  startIndexing: () => Promise<void>;
  loadStatus: () => Promise<void>;
  setProgress: (progress: IndexingProgress) => void;
}

const initialProgress: IndexingProgress = {
  status: 'idle',
  processed: 0,
  total: 0,
  indexedFiles: 0,
};

export const useIndexStore = create<IndexState>((set, get) => ({
  progress: initialProgress,
  startIndexing: async () => {
    await window.electron.startIndexing();
  },
  loadStatus: async () => {
    const progress = await window.electron.getIndexingStatus();
    set({ progress });
  },
  setProgress: (progress) => {
    set({ progress });
  },
}));
