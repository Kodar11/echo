import { create } from 'zustand';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  setSetting: (key: keyof AppSettings, value: boolean) => Promise<void>;
}

const defaultSettings: AppSettings = {
  autoSyncOnStartup: true,
  enableWatchers: true,
  removeStopWords: false,
  enableStemming: false,
  enableLanguageDetection: true,
  indexMetadata: true,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...defaultSettings },
  isLoading: false,
  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await window.electron.getSettings();
      set({ settings });
    } finally {
      set({ isLoading: false });
    }
  },
  setSetting: async (key, value) => {
    const updated = await window.electron.setSetting({ key, value });
    set({ settings: updated });
  },
}));
