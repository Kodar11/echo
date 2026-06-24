import { useEffect, useRef, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import { useIndexStore } from '../stores/indexStore.js';
import { useSearchStore } from '../stores/searchStore.js';
import { EmptyState } from '../components/EmptyState.js';
import { FileIcon } from '../components/FileIcon.js';
import { HighlightedSnippet } from '../components/HighlightedSnippet.js';

export function SearchPage() {
  const {
    query,
    results,
    suggestions,
    isSearching,
    setQuery,
    openFile,
  } = useSearchStore();
  const { status } = useIndexStore();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = () => inputRef.current?.focus();
    document.addEventListener('echo:focus-search', handler);
    return () => document.removeEventListener('echo:focus-search', handler);
  }, []);

  const isShortcutMac = navigator.platform.toLowerCase().includes('mac');
  const shortcutLabel = isShortcutMac ? '⌘K' : 'Ctrl+K';

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
            onKeyDown={(e) => {
              if (e.key === 'Enter') setShowSuggestions(false);
            }}
            placeholder="Search your files..."
            disabled={status.status === 'indexing'}
            className="h-12 w-full rounded-2xl border border-(--border-strong) bg-(--surface) pl-11 pr-24 text-sm theme-text shadow-sm outline-none transition placeholder:text-(--text-tertiary) focus:border-(--accent) focus:ring-[3px] focus:ring-(--ring) disabled:opacity-50"
          />
          <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            <span className="rounded-md border border-(--border-strong) bg-(--panel) px-1.5 py-0.5 text-[11px] font-medium theme-text-tertiary">
              {shortcutLabel}
            </span>
            {isSearching && (
              <span className="text-xs theme-text-tertiary">Searching…</span>
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

        {query && !isSearching && results.length === 0 && (
          <EmptyState
            icon={Search}
            title="No results"
            description={`No files matched "${query}".`}
          />
        )}

        <div className="space-y-2">
          {results.map((result) => (
            <button
              key={result.fileId}
              onClick={() => openFile(result.path)}
              className="group flex w-full items-start gap-3 rounded-xl bg-(--surface) p-3.5 text-left transition hover:bg-(--panel)"
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary group-hover:theme-text">
                <FileIcon filePath={result.path} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium theme-text">
                      {result.filename}
                    </h3>
                    <p className="mt-0.5 truncate text-xs theme-text-tertiary">
                      {result.path}
                    </p>
                  </div>
                  {result.phraseMatch && (
                    <span className="shrink-0 rounded-full bg-(--accent-soft) px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--accent)">
                      Phrase
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-sm leading-relaxed theme-text-secondary">
                  <HighlightedSnippet
                    snippet={result.snippet}
                    terms={result.matchedTerms}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
