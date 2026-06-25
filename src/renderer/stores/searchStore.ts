import { create } from 'zustand';

export type SortMode =
  | 'relevance'
  | 'newest'
  | 'oldest'
  | 'largest'
  | 'smallest'
  | 'alphabetical';

interface SearchState {
  query: string;
  results: SearchResult[];
  suggestions: string[];
  isSearching: boolean;
  totalCount: number;
  durationMs: number;
  sort: SortMode;
  folderIds: number[];
  setQuery: (query: string) => void;
  setSort: (sort: SortMode) => void;
  setFolderIds: (folderIds: number[]) => void;
  search: (query: string) => Promise<void>;
  fetchSuggestions: (prefix: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
  openContainingFolder: (path: string) => Promise<void>;
  copyPath: (path: string) => Promise<void>;
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let searchGeneration = 0;

function sortResults(results: SearchResult[], sort: SortMode): SearchResult[] {
  if (sort === 'relevance') return results;

  const sorted = [...results];
  switch (sort) {
    case 'newest':
      sorted.sort((a, b) => b.modifiedTime - a.modifiedTime);
      break;
    case 'oldest':
      sorted.sort((a, b) => a.modifiedTime - b.modifiedTime);
      break;
    case 'largest':
      sorted.sort((a, b) => b.size - a.size);
      break;
    case 'smallest':
      sorted.sort((a, b) => a.size - b.size);
      break;
    case 'alphabetical':
      sorted.sort((a, b) => a.filename.localeCompare(b.filename));
      break;
  }
  return sorted;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  suggestions: [],
  isSearching: false,
  totalCount: 0,
  durationMs: 0,
  sort: 'relevance',
  folderIds: [],
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
  setSort: (sort) => {
    set({ sort });
    set((state) => ({ results: sortResults(state.results, sort) }));
  },
  setFolderIds: (folderIds) => {
    set({ folderIds });
    get().search(get().query);
  },
  search: async (query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      set({ results: [], isSearching: false, totalCount: 0, durationMs: 0 });
      return;
    }

    const generation = ++searchGeneration;
    set({ isSearching: true });

    try {
      const response = await window.electron.search({
        query: trimmed,
        folderIds: get().folderIds.length > 0 ? get().folderIds : undefined,
      });

      // Ignore stale search results.
      if (generation !== searchGeneration) return;

      const sorted = sortResults(response.results, get().sort);
      set({
        results: sorted,
        totalCount: response.totalCount,
        durationMs: response.durationMs,
        isSearching: false,
      });
    } catch (err) {
      if (generation === searchGeneration) {
        console.error('Search failed:', err);
        set({ results: [], isSearching: false, totalCount: 0, durationMs: 0 });
      }
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
  openContainingFolder: async (path) => {
    await window.electron.openContainingFolder({ path });
  },
  copyPath: async (path) => {
    await navigator.clipboard.writeText(path);
  },
}));
