import { create } from 'zustand';

interface HealthState {
  stats: HealthStats | null;
  isLoading: boolean;
  loadHealthStats: () => Promise<void>;
}

export const useHealthStore = create<HealthState>((set) => ({
  stats: null,
  isLoading: false,
  loadHealthStats: async () => {
    set({ isLoading: true });
    try {
      const stats = await window.electron.getHealthStats();
      set({ stats });
    } finally {
      set({ isLoading: false });
    }
  },
}));
