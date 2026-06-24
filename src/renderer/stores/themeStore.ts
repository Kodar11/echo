import { create } from 'zustand';

type Theme = 'light' | 'dark';
export type ThemePreference = 'system' | Theme;

interface ThemeState {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  setTheme: (theme: Theme) => void;
  syncWithSystem: () => void;
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

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getSystemTheme(),
  preference: 'system',
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
