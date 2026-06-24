import { create } from 'zustand';

interface SearchState {
  query: string;
  results: SearchResult[];
  suggestions: string[];
  isSearching: boolean;
  setQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  fetchSuggestions: (prefix: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  suggestions: [],
  isSearching: false,
  setQuery: (query) => {
    set({ query });
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      get().search(query);
      if (query.length >= 2) {
        get().fetchSuggestions(query);
      } else {
        set({ suggestions: [] });
      }
    }, 150);
  },
  search: async (query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      set({ results: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      const results = await window.electron.search({ query: trimmed });
      set({ results });
    } finally {
      set({ isSearching: false });
    }
  },
  fetchSuggestions: async (prefix) => {
    const trimmed = prefix.trim().toLowerCase();
    if (!trimmed) {
      set({ suggestions: [] });
      return;
    }
    const suggestions = await window.electron.getAutocompleteSuggestions({
      prefix: trimmed,
    });
    set({ suggestions });
  },
  openFile: async (path) => {
    await window.electron.openFile({ path });
  },
}));
