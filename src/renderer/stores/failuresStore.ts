import { create } from 'zustand';

interface FailuresState {
  failures: IndexingFailure[];
  isLoading: boolean;
  loadFailures: () => Promise<void>;
  retryFailure: (path: string) => Promise<void>;
  setIgnored: (path: string, ignored: boolean) => Promise<void>;
}

export const useFailuresStore = create<FailuresState>((set, get) => ({
  failures: [],
  isLoading: false,
  loadFailures: async () => {
    set({ isLoading: true });
    try {
      const failures = await window.electron.getIndexingFailures();
      set({ failures });
    } finally {
      set({ isLoading: false });
    }
  },
  retryFailure: async (path) => {
    await window.electron.retryIndexingFailure({ path });
    await get().loadFailures();
  },
  setIgnored: async (path, ignored) => {
    await window.electron.ignoreIndexingFailure({ path, ignored });
    await get().loadFailures();
  },
}));
