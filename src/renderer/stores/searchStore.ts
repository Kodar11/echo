import { create } from 'zustand';
import { completableToken, composeQuery, type SearchFilter } from '../lib/query.js';

export type SortMode =
  | 'relevance'
  | 'newest'
  | 'oldest'
  | 'largest'
  | 'smallest'
  | 'alphabetical';

interface SearchState {
  /** Text in the search box. */
  query: string;
  /** Filter chips; appended to the text as query-language tokens. */
  filters: SearchFilter[];
  /** Library folders the search is limited to (empty = all). */
  folderIds: number[];
  results: SearchResult[];
  /** Autocompletion for the word being typed (lower-cased). */
  completion: string | null;
  isSearching: boolean;
  /** Parse / filter error for the current query, shown instead of results. */
  error: QueryError | null;
  /** The search request itself failed (IPC / engine exception). */
  failed: boolean;
  totalCount: number;
  durationMs: number;
  /** Composed query the current results belong to ('' = none yet). */
  resultsFor: string;
  sort: SortMode;
  setQuery: (query: string) => void;
  setFilters: (filters: SearchFilter[]) => void;
  setFolderIds: (folderIds: number[]) => void;
  setSort: (sort: SortMode) => void;
  clear: () => void;
  /** Re-runs the current search (e.g. after the index changed). */
  refresh: () => void;
  search: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  openContainingFolder: (path: string) => Promise<void>;
  copyPath: (path: string) => Promise<void>;
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let completionTimeout: ReturnType<typeof setTimeout> | null = null;
let searchGeneration = 0;
let completionGeneration = 0;

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

export const useSearchStore = create<SearchState>((set, get) => {
  const scheduleSearch = (delay: number) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => void get().search(), delay);
  };

  const scheduleCompletion = (query: string) => {
    if (completionTimeout) clearTimeout(completionTimeout);
    const token = completableToken(query);
    const generation = ++completionGeneration;
    if (!token) {
      if (get().completion !== null) set({ completion: null });
      return;
    }
    // Keep a still-valid completion while the next one loads.
    const current = get().completion;
    if (current && !current.startsWith(token.toLowerCase())) set({ completion: null });
    completionTimeout = setTimeout(async () => {
      try {
        const suggestions = await window.electron.getAutocompleteSuggestions({
          prefix: token.toLowerCase(),
        });
        if (generation !== completionGeneration) return;
        const lower = token.toLowerCase();
        const match = suggestions.find((s) => s.startsWith(lower) && s.length > lower.length);
        set({ completion: match ?? null });
      } catch {
        if (generation === completionGeneration) set({ completion: null });
      }
    }, 90);
  };

  return {
    query: '',
    filters: [],
    folderIds: [],
    results: [],
    completion: null,
    isSearching: false,
    error: null,
    failed: false,
    totalCount: 0,
    durationMs: 0,
    resultsFor: '',
    sort: 'relevance',

    setQuery: (query) => {
      set({ query });
      scheduleSearch(120);
      scheduleCompletion(query);
    },
    setFilters: (filters) => {
      set({ filters });
      scheduleSearch(0);
    },
    setFolderIds: (folderIds) => {
      set({ folderIds });
      scheduleSearch(0);
    },
    setSort: (sort) => {
      set((state) => ({ sort, results: sortResults(state.results, sort) }));
    },
    clear: () => {
      if (searchTimeout) clearTimeout(searchTimeout);
      ++searchGeneration;
      ++completionGeneration;
      set({
        query: '',
        completion: null,
        results: [],
        error: null,
        failed: false,
        isSearching: false,
        totalCount: 0,
        durationMs: 0,
        resultsFor: '',
      });
      if (get().filters.length > 0) scheduleSearch(0);
    },
    refresh: () => {
      if (composeQuery(get().query, get().filters)) scheduleSearch(0);
    },

    search: async () => {
      const { query, filters, folderIds } = get();
      const composed = composeQuery(query, filters);
      const generation = ++searchGeneration;
      if (!composed) {
        set({
          results: [],
          isSearching: false,
          error: null,
          failed: false,
          totalCount: 0,
          durationMs: 0,
          resultsFor: '',
        });
        return;
      }

      set({ isSearching: true });
      try {
        const response = await window.electron.search({
          query: composed,
          folderIds: folderIds.length > 0 ? folderIds : undefined,
          requestId: generation,
        });
        // A newer query was issued meanwhile: never let this one overwrite it.
        if (generation !== searchGeneration || response.cancelled) return;
        set({
          results: sortResults(response.results, get().sort),
          error: response.error ?? null,
          failed: false,
          totalCount: response.totalCount,
          durationMs: response.durationMs,
          resultsFor: composed,
          isSearching: false,
        });
      } catch (err) {
        if (generation !== searchGeneration) return;
        console.error('Search failed:', err);
        set({
          results: [],
          isSearching: false,
          error: null,
          failed: true,
          totalCount: 0,
          durationMs: 0,
          resultsFor: composed,
        });
      }
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
  };
});
