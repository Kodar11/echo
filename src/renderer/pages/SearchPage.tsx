import { useEffect, useRef, useState } from 'react';
import {
  FileText,
  FolderOpen,
  Loader2,
  Search,
} from 'lucide-react';
import { useFoldersStore } from '../stores/foldersStore.js';
import { useIndexStore } from '../stores/indexStore.js';
import { useSearchStore } from '../stores/searchStore.js';
import { EmptyState } from '../components/EmptyState.js';
import { SearchResultItem } from '../components/SearchResultItem.js';
import { SearchScopeSelector } from '../components/SearchScopeSelector.js';
import { SearchSortSelector } from '../components/SearchSortSelector.js';
import { SearchStats } from '../components/SearchStats.js';

export function SearchPage() {
  const {
    query,
    results,
    suggestions,
    isSearching,
    totalCount,
    durationMs,
    sort,
    folderIds,
    setQuery,
    setSort,
    setFolderIds,
    openFile,
    openContainingFolder,
    copyPath,
  } = useSearchStore();
  const { status } = useIndexStore();
  const { folders, loadFolders } = useFoldersStore();

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = () => inputRef.current?.focus();
    document.addEventListener('echo:focus-search', handler);
    return () => document.removeEventListener('echo:focus-search', handler);
  }, []);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [query, results.length]);

  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const element = listRef.current.children[selectedIndex] as HTMLElement;
      element?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      if (selectedIndex === 0) {
        inputRef.current?.focus();
      }
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && results[selectedIndex]) {
        openFile(results[selectedIndex].path);
      } else {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      if (selectedIndex >= 0 && results[selectedIndex]) {
        e.preventDefault();
        copyPath(results[selectedIndex].path);
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  const isShortcutMac = navigator.platform.toLowerCase().includes('mac');
  const shortcutLabel = isShortcutMac ? '⌘K' : 'Ctrl+K';

  const progressPercent =
    status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-(--border) bg-(--surface) px-6 py-4">
        <div className="relative mx-auto w-full max-w-3xl">
          <div className="relative">
            <Search
              size={18}
              strokeWidth={1.8}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-(--text-tertiary)"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={handleKeyDown}
              placeholder="Search your files..."
              disabled={status.status === 'indexing' && status.total === 0}
              className="h-12 w-full rounded-2xl border border-(--border-strong) bg-(--panel) pl-11 pr-24 text-sm theme-text shadow-sm outline-none transition placeholder:text-(--text-tertiary) focus:border-(--accent) focus:ring-[3px] focus:ring-(--ring) disabled:opacity-50"
            />
            <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              <span className="rounded-md border border-(--border-strong) bg-(--surface) px-1.5 py-0.5 text-[11px] font-medium theme-text-tertiary">
                {shortcutLabel}
              </span>
              {isSearching && (
                <Loader2
                  size={14}
                  className="animate-spin text-(--text-tertiary)"
                />
              )}
            </div>
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-(--border) bg-(--surface) shadow-lg">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm theme-text transition hover:bg-(--panel)"
                    onMouseDown={() => {
                      setQuery(suggestion);
                      setShowSuggestions(false);
                    }}
                  >
                    <Search size={14} className="theme-text-tertiary" />
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mx-auto mt-3 flex max-w-3xl items-center justify-between">
          <SearchScopeSelector
            folders={folders}
            selectedIds={folderIds}
            onChange={setFolderIds}
          />
          <SearchSortSelector value={sort} onChange={setSort} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto w-full max-w-3xl">
          {!query && status.status === 'never_indexed' && (
            <EmptyState
              icon={FileText}
              title="No index yet"
              description="Add folders and build an index to start searching your files."
            />
          )}

          {!query && status.status === 'indexed' && (
            <EmptyState
              icon={Search}
              title="Start typing"
              description="Enter a query to search across your indexed files. Try filters like type:pdf or before:2026-01-01."
            />
          )}

          {!query && status.status === 'indexing' && (
            <EmptyState
              icon={Loader2}
              title="Indexing in progress"
              description={
                status.currentFile
                  ? `Processing ${status.currentFile}`
                  : 'Scanning your folders...'
              }
            />
          )}

          {query && !isSearching && results.length === 0 && (
            <EmptyState
              icon={Search}
              title="No results"
              description={`No files matched "${query}".`}
            />
          )}

          {isSearching && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2
                size={28}
                className="animate-spin text-(--text-tertiary)"
              />
              <p className="mt-3 text-xs theme-text-tertiary">Searching...</p>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <SearchStats totalCount={totalCount} durationMs={durationMs} />
              </div>
              <div ref={listRef} className="space-y-2">
                {results.map((result, index) => (
                  <SearchResultItem
                    key={result.fileId}
                    result={result}
                    isSelected={index === selectedIndex}
                    matchedTerms={result.matchedTerms}
                    onOpen={() => openFile(result.path)}
                    onOpenFolder={(e) => {
                      e.stopPropagation();
                      openContainingFolder(result.path);
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {status.status === 'indexing' && status.total > 0 && (
            <div className="mt-6 rounded-xl border border-(--border) bg-(--surface) p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="theme-text-secondary">
                  {status.currentFile
                    ? `Indexing ${getBasename(status.currentFile)}`
                    : 'Indexing files...'}
                </span>
                <span className="font-medium theme-text">
                  {status.processed} / {status.total}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-(--border-strong)">
                <div
                  className="h-full rounded-full bg-(--accent) transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {status.queueLength > 0 && status.status !== 'indexing' && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs theme-text-tertiary">
              <Loader2 size={12} className="animate-spin" />
              {status.queueLength} file{status.queueLength === 1 ? '' : 's'} pending
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getBasename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}
