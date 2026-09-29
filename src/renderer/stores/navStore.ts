import { create } from 'zustand';

export type Page = 'search' | 'library' | 'settings';

export type SettingsSectionId =
  | 'appearance'
  | 'search'
  | 'indexing'
  | 'privacy'
  | 'backup'
  | 'advanced'
  | 'diagnostics';

interface NavState {
  page: Page;
  settingsSection: SettingsSectionId;
  navigate: (page: Page) => void;
  openSettings: (section?: SettingsSectionId) => void;
}

export const useNavStore = create<NavState>((set) => ({
  page: 'search',
  settingsSection: 'appearance',
  navigate: (page) => set({ page }),
  openSettings: (section) =>
    set((state) => ({ page: 'settings', settingsSection: section ?? state.settingsSection })),
}));

/** Asks the search page to focus its input (after navigating to it). */
export function focusSearch(): void {
  useNavStore.getState().navigate('search');
  requestAnimationFrame(() => document.dispatchEvent(new CustomEvent('echo:focus-search')));
}
