import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  FolderOpen,
  Loader2,
  Search,
  ExternalLink,
} from 'lucide-react';
import { useIndexStore } from '../stores/indexStore.js';
import { useSearchStore } from '../stores/searchStore.js';
import { EmptyState } from '../components/EmptyState.js';
import { FileIcon } from '../components/FileIcon.js';
import { HighlightedSnippet } from '../components/HighlightedSnippet.js';
import { getBasename, getDirname, getExtension } from '../lib/path.js';

export function SearchPage() {
  const {
    query,
    results,
    suggestions,
    isSearching,
    setQuery,
    openFile,
    openContainingFolder,
  } = useSearchStore();
  const { status } = useIndexStore();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
    }
  };

  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const element = listRef.current.children[selectedIndex] as HTMLElement;
      element?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const isShortcutMac = navigator.platform.toLowerCase().includes('mac');
  const shortcutLabel = isShortcutMac ? '⌘K' : 'Ctrl+K';

  const progressPercent =
    status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-6">
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
            className="h-12 w-full rounded-2xl border border-(--border-strong) bg-(--surface) pl-11 pr-24 text-sm theme-text shadow-sm outline-none transition placeholder:text-(--text-tertiary) focus:border-(--accent) focus:ring-[3px] focus:ring-(--ring) disabled:opacity-50"
          />
          <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            <span className="rounded-md border border-(--border-strong) bg-(--panel) px-1.5 py-0.5 text-[11px] font-medium theme-text-tertiary">
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

      <div className="mx-auto mt-8 w-full max-w-3xl">
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
            description="Enter a query to search across your indexed files."
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
          <div className="flex justify-center py-12">
            <Loader2
              size={24}
              className="animate-spin text-(--text-tertiary)"
            />
          </div>
        )}

        <div ref={listRef} className="space-y-2">
          {results.map((result, index) => (
            <SearchResultCard
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
          <div className="mt-4 flex items-center justify-center gap-2 text-xs theme-text-secondary">
            <Loader2 size={12} className="animate-spin" />
            {status.queueLength} file{status.queueLength === 1 ? '' : 's'} pending
          </div>
        )}
      </div>
    </div>
  );
}

function SearchResultCard({
  result,
  isSelected,
  matchedTerms,
  onOpen,
  onOpenFolder,
}: {
  result: SearchResult;
  isSelected: boolean;
  matchedTerms: string[];
  onOpen: () => void;
  onOpenFolder: (e: React.MouseEvent) => void;
}) {
  const extension = getExtension(result.path);
  const directory = getDirname(result.path);

  return (
    <button
      onClick={onOpen}
      className={`group relative flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
        isSelected
          ? 'border-(--accent) bg-(--accent-soft)'
          : 'border-transparent bg-(--surface) hover:bg-(--panel)'
      }`}
    >
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary group-hover:theme-text">
        <FileIcon filePath={result.path} size={20} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-medium theme-text">
                {result.filename}
              </h3>
              {extension && (
                <span className="shrink-0 rounded-md bg-(--panel) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--text-secondary)">
                  {extension.slice(1)}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs theme-text-tertiary">
              {directory}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={onOpenFolder}
              className="rounded-md p-1.5 text-(--text-tertiary) transition hover:bg-(--panel) hover:theme-text"
              title="Open containing folder"
            >
              <FolderOpen size={14} strokeWidth={1.8} />
            </button>
            <span className="rounded-md p-1.5 text-(--text-tertiary)">
              <ExternalLink size={14} strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="mt-2 text-sm leading-relaxed theme-text-secondary">
          <HighlightedSnippet snippet={result.snippet} terms={matchedTerms} />
        </div>

        <div className="mt-2 flex items-center gap-3 text-[11px] theme-text-tertiary">
          <span>{formatBytes(result.size)}</span>
          <span>•</span>
          <span>{formatRelativeTime(result.modifiedTime)}</span>
          {result.phraseMatch && (
            <>
              <span>•</span>
              <span className="font-medium text-(--accent)">Phrase match</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
