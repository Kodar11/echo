import clsx from 'clsx';
import { FolderPlus, Lock, X } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { EchoMark } from '../components/brand/EchoMark.js';
import { EchoRipple } from '../components/brand/EchoRipple.js';
import { SearchBar } from '../components/search/SearchBar.js';
import { SearchFilterBar } from '../components/search/SearchFilters.js';
import { SearchResultRow } from '../components/search/SearchResultRow.js';
import {
  NoLibrary,
  NoResults,
  QueryProblem,
  ResultSkeleton,
  SearchFailed,
} from '../components/search/SearchStates.js';
import { Button } from '../components/ui/Button.js';
import { Kbd, MOD_KEY } from '../components/ui/Kbd.js';
import { ProgressBar } from '../components/ui/ProgressBar.js';
import { Select } from '../components/ui/Select.js';
import { useLibraryStatus } from '../components/status/useLibraryStatus.js';
import { formatCount, plural } from '../lib/format.js';
import { composeQuery, SEARCH_EXAMPLES } from '../lib/query.js';
import { useFoldersStore } from '../stores/foldersStore.js';
import { useIndexStore } from '../stores/indexStore.js';
import { useNavStore } from '../stores/navStore.js';
import { useSearchStore, type SortMode } from '../stores/searchStore.js';
import { humanizeError, toast } from '../stores/toastStore.js';
import { addFolderWithFeedback } from '../lib/actions.js';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'largest', label: 'Largest first' },
  { value: 'smallest', label: 'Smallest first' },
  { value: 'alphabetical', label: 'Name (A–Z)' },
];

const TIPS_KEY = 'echo.searchTipsDismissed';

function readTipsDismissed(): boolean {
  try {
    return localStorage.getItem(TIPS_KEY) === '1';
  } catch {
    return false;
  }
}

export function SearchPage() {
  const query = useSearchStore((s) => s.query);
  const filters = useSearchStore((s) => s.filters);
  const folderIds = useSearchStore((s) => s.folderIds);
  const results = useSearchStore((s) => s.results);
  const error = useSearchStore((s) => s.error);
  const failed = useSearchStore((s) => s.failed);
  const isSearching = useSearchStore((s) => s.isSearching);
  const totalCount = useSearchStore((s) => s.totalCount);
  const durationMs = useSearchStore((s) => s.durationMs);
  const resultsFor = useSearchStore((s) => s.resultsFor);
  const sort = useSearchStore((s) => s.sort);
  const setSort = useSearchStore((s) => s.setSort);
  const setFilters = useSearchStore((s) => s.setFilters);
  const setFolderIds = useSearchStore((s) => s.setFolderIds);
  const setQuery = useSearchStore((s) => s.setQuery);
  const clear = useSearchStore((s) => s.clear);
  const refresh = useSearchStore((s) => s.refresh);

  const folders = useFoldersStore((s) => s.folders);
  const foldersLoaded = useFoldersStore((s) => s.loaded);
  const indexing = useIndexStore((s) => s.progress.status === 'running');

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [selected, setSelected] = useState(0);

  const composed = composeQuery(query, filters);
  const hero = composed === '';
  const settled = resultsFor === composed && !isSearching;
  const roots = useMemo(() => folders.map((f) => f.path), [folders]);

  useEffect(() => {
    inputRef.current?.focus();
    const focus = () => inputRef.current?.focus();
    document.addEventListener('echo:focus-search', focus);
    return () => document.removeEventListener('echo:focus-search', focus);
  }, []);

  // New results → select the best match.
  useEffect(() => {
    setSelected(0);
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [results]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const open = useCallback(async (path: string) => {
    try {
      await useSearchStore.getState().openFile(path);
    } catch (err) {
      toast({ tone: 'error', title: 'Echo couldn’t open this file', description: humanizeError(err, 'It may have been moved or deleted.') });
    }
  }, []);
  const reveal = useCallback((path: string) => {
    void useSearchStore.getState().openContainingFolder(path);
  }, []);
  const copy = useCallback(async (path: string) => {
    await useSearchStore.getState().copyPath(path);
    toast({ tone: 'success', title: 'Path copied' }, 1800);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    const count = results.length;
    switch (e.key) {
      case 'ArrowDown':
        if (!count) return;
        e.preventDefault();
        setSelected((i) => Math.min(count - 1, i + 1));
        break;
      case 'ArrowUp':
        if (!count) return;
        e.preventDefault();
        setSelected((i) => Math.max(0, i - 1));
        break;
      case 'PageDown':
        if (!count) return;
        e.preventDefault();
        setSelected((i) => Math.min(count - 1, i + 6));
        break;
      case 'PageUp':
        if (!count) return;
        e.preventDefault();
        setSelected((i) => Math.max(0, i - 6));
        break;
      case 'Enter': {
        const target = results[selected];
        if (!target) return;
        e.preventDefault();
        if (mod || e.shiftKey) reveal(target.path);
        else void open(target.path);
        break;
      }
      case 'Escape':
        if (query) {
          e.preventDefault();
          clear();
        } else if (filters.length > 0) {
          e.preventDefault();
          setFilters([]);
        } else {
          e.currentTarget.blur();
        }
        break;
      default:
        if (mod && e.key.toLowerCase() === 'c') {
          const input = e.currentTarget;
          const hasSelection = input.selectionStart !== input.selectionEnd;
          const target = results[selected];
          if (!hasSelection && target) {
            e.preventDefault();
            void copy(target.path);
          }
        } else if (mod && e.key.toLowerCase() === 'l') {
          e.preventDefault();
          e.currentTarget.select();
        }
    }
  };

  const activeId = results[selected] ? `${listboxId}-${selected}` : undefined;
  const invalid = settled && !!error;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <EchoRipple
        className={clsx(
          'absolute left-1/2 h-[560px] w-[560px] -translate-x-1/2 transition-opacity duration-500',
          hero ? 'opacity-100' : 'opacity-0'
        )}
        style={{ top: 'calc(clamp(28px, 13vh, 132px) + 20px - 280px)' }}
        active={hero}
      />

      {/* Search header: brand (hero only), search bar and chips. */}
      <div
        className="relative shrink-0 px-6 transition-[padding] duration-300 ease-out"
        style={{ paddingTop: hero ? 'clamp(28px, 13vh, 132px)' : 8 }}
      >
        <div
          className="mx-auto transition-[max-width] duration-300 ease-out"
          style={{ maxWidth: hero ? 680 : 880 }}
        >
          <div
            className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
            style={{ gridTemplateRows: hero ? '1fr' : '0fr', opacity: hero ? 1 : 0 }}
            aria-hidden={!hero}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col items-center pb-7 text-center">
                <EchoMark size={40} />
                <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em] text-fg">Echo</h1>
                <p className="mt-1 text-lg text-fg-2">Search everything you keep on your computer.</p>
              </div>
            </div>
          </div>

          <SearchBar
            ref={inputRef}
            size={hero ? 'hero' : 'compact'}
            onKeyDown={onKeyDown}
            listboxId={listboxId}
            activeDescendant={activeId}
            expanded={results.length > 0}
            invalid={invalid}
          />

          <div className={clsx('mt-3', hero && 'flex justify-center')}>
            <SearchFilterBar showSuggestions={hero} />
          </div>
        </div>
      </div>

      {hero ? (
        <HeroBody
          foldersLoaded={foldersLoaded}
          folderCount={folders.length}
          onExample={(example) => {
            setQuery(example);
            inputRef.current?.focus();
          }}
        />
      ) : (
        <>
          <div ref={scrollerRef} className="relative mt-3 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <div className="mx-auto max-w-[880px]">
              {results.length > 0 ? (
                <>
                  <div className="flex h-8 items-center justify-between gap-3 px-3">
                    <p className="text-xs tabular-nums text-fg-3" aria-live="polite">
                      {totalCount > results.length
                        ? `Top ${formatCount(results.length)} of ${formatCount(totalCount)} results`
                        : plural(totalCount, 'result')}
                      <span className="opacity-70"> · {durationMs} ms</span>
                    </p>
                    <Select
                      appearance="inline"
                      ariaLabel="Sort results"
                      value={sort}
                      options={SORT_OPTIONS}
                      onChange={setSort}
                    />
                  </div>
                  <div
                    ref={listRef}
                    id={listboxId}
                    role="listbox"
                    aria-label="Search results"
                    className={clsx('flex flex-col gap-px transition-opacity duration-150', isSearching && 'opacity-70')}
                  >
                    {results.map((result, index) => (
                      <SearchResultRow
                        key={result.fileId}
                        id={`${listboxId}-${index}`}
                        result={result}
                        index={index}
                        selected={index === selected}
                        roots={roots}
                        onSelect={setSelected}
                        onOpen={open}
                        onReveal={reveal}
                        onCopy={copy}
                      />
                    ))}
                  </div>
                </>
              ) : !settled ? (
                <div className="pt-8">
                  <ResultSkeleton />
                </div>
              ) : failed ? (
                <SearchFailed onRetry={refresh} />
              ) : error ? (
                <QueryProblem error={error} hasFilters={filters.length > 0} onClearFilters={() => setFilters([])} />
              ) : folders.length === 0 ? (
                <NoLibrary onAddFolder={addFolderWithFeedback} />
              ) : (
                <NoResults
                  query={query.trim()}
                  hasFilters={filters.length > 0}
                  scoped={folderIds.length > 0}
                  indexing={indexing}
                  onClearFilters={() => setFilters([])}
                  onSearchEverywhere={() => setFolderIds([])}
                />
              )}
            </div>
          </div>
          {results.length > 0 && <KeyboardHints />}
        </>
      )}
    </div>
  );
}

function KeyboardHints() {
  return (
    <div className="flex h-9 shrink-0 items-center justify-center gap-5 border-t border-line text-2xs text-fg-3 max-[640px]:hidden">
      <span className="flex items-center gap-1.5">
        <Kbd keys={['↑', '↓']} /> Navigate
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd keys={['↵']} /> Open
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd keys={[MOD_KEY, '↵']} /> Show in folder
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd keys={[MOD_KEY, 'C']} /> Copy path
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd keys={['Esc']} /> Clear
      </span>
    </div>
  );
}

/** What sits under the search bar before anything is typed. */
function HeroBody({
  foldersLoaded,
  folderCount,
  onExample,
}: {
  foldersLoaded: boolean;
  folderCount: number;
  onExample: (example: string) => void;
}) {
  const status = useLibraryStatus();
  const indexedFiles = useIndexStore((s) => s.statistics.totalIndexedFiles);
  const progress = useIndexStore((s) => s.progress);
  const openSettings = useNavStore((s) => s.openSettings);
  const navigate = useNavStore((s) => s.navigate);
  const [tipsDismissed, setTipsDismissed] = useState(readTipsDismissed);

  if (!foldersLoaded) return <div className="flex-1" />;

  let body: React.ReactNode;
  if (folderCount === 0) {
    body = (
      <div className="flex flex-col items-center gap-4">
        <Button size="lg" variant="primary" icon={<FolderPlus size={16} />} onClick={addFolderWithFeedback}>
          Add your first folder
        </Button>
        <p className="flex max-w-sm items-center gap-1.5 text-center text-xs text-fg-3">
          <Lock size={12} className="shrink-0" />
          Echo indexes and searches your files locally. Your index stays on this computer.
        </p>
      </div>
    );
  } else if (status.running && indexedFiles === 0) {
    body = (
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-fg">{status.title}</p>
          {progress.total > 0 && (
            <p className="text-xs tabular-nums text-fg-3">
              {formatCount(Math.min(progress.processed, progress.total))} / {formatCount(progress.total)}
            </p>
          )}
        </div>
        <ProgressBar className="mt-3" value={status.fraction} label="Indexing progress" />
        <p className="mt-2.5 text-xs text-fg-3">Your files become searchable when this finishes.</p>
      </div>
    );
  } else if (!status.running && indexedFiles === 0) {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="max-w-sm text-sm text-fg-2">
          Echo didn’t find any files it can read in your library yet. It indexes PDFs, Word documents, web pages,
          Markdown and text files.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('library')}>
            Open library
          </Button>
          <Button variant="ghost" onClick={() => openSettings('indexing')}>
            File types
          </Button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs text-fg-3">
          Searching {plural(indexedFiles, 'file')} in {plural(folderCount, 'folder')}
        </p>
        {!tipsDismissed && (
          <div className="animate-fade-in flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs text-fg-3">
            <span>Try</span>
            {SEARCH_EXAMPLES.map((example, i) => (
              <span key={example} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onExample(example)}
                  className="rounded-sm bg-hover px-1.5 py-0.5 font-mono text-[11.5px] text-fg-2 transition-colors hover:bg-press hover:text-fg"
                >
                  {example}
                </button>
                {i < SEARCH_EXAMPLES.length - 1 && <span className="opacity-50">·</span>}
              </span>
            ))}
            <button
              type="button"
              aria-label="Hide search tips"
              onClick={() => {
                setTipsDismissed(true);
                try {
                  localStorage.setItem(TIPS_KEY, '1');
                } catch {
                  // Tips simply reappear next time.
                }
              }}
              className="ml-1 flex h-5 w-5 items-center justify-center rounded-sm text-fg-3 hover:bg-hover hover:text-fg"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return <div className="animate-fade-in relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pt-8">{body}</div>;
}
