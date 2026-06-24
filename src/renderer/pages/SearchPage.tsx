import { useEffect, useRef, useState } from 'react';
import { useSearchStore } from '../stores/searchStore.js';
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-24">
      <h1 className="mb-8 text-4xl font-semibold tracking-tight theme-text">
        Echo
      </h1>

      <div className="relative w-full">
        <div className="relative">
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
              if (e.key === 'Enter') {
                setShowSuggestions(false);
              }
            }}
            placeholder="Search your files..."
            className="w-full rounded-2xl border border-(--border) bg-(--surface) px-6 py-4 text-lg theme-text shadow-lg outline-none ring-0 transition placeholder:text-(--muted) focus:border-(--muted)"
          />
          {isSearching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm theme-muted">
              Searching…
            </span>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-(--border) bg-(--surface) shadow-xl">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  className="w-full px-5 py-2.5 text-left text-sm theme-text transition hover:bg-(--button-hover)"
                  onMouseDown={() => {
                    setQuery(suggestion);
                    setShowSuggestions(false);
                  }}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 w-full space-y-3">
        {results.length === 0 && query && !isSearching && (
          <p className="text-center text-sm theme-muted">
            No results for "{query}"
          </p>
        )}

        {results.map((result) => (
          <button
            key={result.fileId}
            onClick={() => openFile(result.path)}
            className="w-full rounded-2xl border border-(--border) bg-(--surface) p-5 text-left shadow-sm transition hover:border-(--muted) hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-medium theme-text">
                  {result.filename}
                </h3>
                <p className="mt-0.5 truncate text-xs theme-muted">
                  {result.path}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-(--button) px-2 py-0.5 text-xs theme-muted">
                {result.phraseMatch ? 'phrase' : Math.round(result.score)}
              </span>
            </div>
            <div className="mt-3 text-sm leading-relaxed theme-muted">
              <HighlightedSnippet
                snippet={result.snippet}
                terms={result.matchedTerms}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
