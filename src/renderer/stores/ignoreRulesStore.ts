import { create } from 'zustand';

interface IgnoreRulesState {
  rules: IgnoreRule[];
  isLoading: boolean;
  loadRules: () => Promise<void>;
  addRule: (pattern: string, type?: 'glob' | 'folder') => Promise<void>;
  setEnabled: (id: number, enabled: boolean) => Promise<void>;
  deleteRule: (id: number) => Promise<void>;
}

export const useIgnoreRulesStore = create<IgnoreRulesState>((set, get) => ({
  rules: [],
  isLoading: false,
  loadRules: async () => {
    set({ isLoading: true });
    try {
      const rules = await window.electron.getIgnoreRules();
      set({ rules });
    } finally {
      set({ isLoading: false });
    }
  },
  addRule: async (pattern, type) => {
    await window.electron.addIgnoreRule({ pattern, type });
    await get().loadRules();
  },
  setEnabled: async (id, enabled) => {
    await window.electron.setIgnoreRuleEnabled({ id, enabled });
    await get().loadRules();
  },
  deleteRule: async (id) => {
    await window.electron.deleteIgnoreRule({ id });
    await get().loadRules();
  },
}));
