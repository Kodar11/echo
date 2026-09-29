import { create } from 'zustand';

type Theme = 'light' | 'dark';
export type ThemePreference = 'system' | Theme;

interface ThemeState {
  theme: Theme;
  preference: ThemePreference;
  initialized: boolean;
  setPreference: (preference: ThemePreference) => void;
  setTheme: (theme: Theme) => void;
  syncWithSystem: () => void;
  initializeFromSettings: () => Promise<void>;
  persistPreference: (preference: ThemePreference) => Promise<void>;
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolveTheme(preference: ThemePreference): Theme {
  return preference === 'system' ? getSystemTheme() : preference;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getSystemTheme(),
  preference: 'system',
  initialized: false,

  setPreference: (preference) => {
    set({ preference, theme: resolveTheme(preference) });
  },

  setTheme: (theme) => set({ theme, preference: theme }),

  syncWithSystem: () => {
    set((state) =>
      state.preference === 'system'
        ? { theme: getSystemTheme() }
        : state
    );
  },

  initializeFromSettings: async () => {
    if (get().initialized) return;
    try {
      const settings = await window.electron.getSettings();
      const preference = settings.themePreference ?? 'system';
      set({
        preference,
        theme: resolveTheme(preference),
        initialized: true,
      });
    } catch {
      set({ initialized: true });
    }
  },

  persistPreference: async (preference) => {
    get().setPreference(preference);
    try {
      await window.electron.setSetting({
        key: 'themePreference',
        value: preference,
      });
    } catch (err) {
      console.error('Failed to persist theme preference:', err);
    }
  },
}));

export function listenToSystemThemeChanges(
  callback: (theme: Theme) => void
): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };
  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
}
