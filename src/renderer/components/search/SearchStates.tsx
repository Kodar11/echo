import { AlertCircle, FolderPlus, RotateCw, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { EchoMark } from '../brand/EchoMark.js';
import { Button } from '../ui/Button.js';

interface StatePanelProps {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}

/** Centered message used for every non-result state in the results area. */
export function StatePanel({ icon, title, description, children }: StatePanelProps) {
  return (
    <div className="animate-rise-in mx-auto flex max-w-md flex-col items-center px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-fg-3">
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-semibold text-fg [overflow-wrap:anywhere]">{title}</h2>
      {description && <div className="mt-1.5 text-sm text-fg-2">{description}</div>}
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

export function NoResults({
  query,
  hasFilters,
  scoped,
  indexing,
  onClearFilters,
  onSearchEverywhere,
}: {
  query: string;
  hasFilters: boolean;
  scoped: boolean;
  indexing: boolean;
  onClearFilters: () => void;
  onSearchEverywhere: () => void;
}) {
  return (
    <StatePanel
      icon={<SearchX size={20} />}
      title={query ? <>No results for “{query}”</> : 'No files match these filters'}
      description={
        indexing
          ? 'Echo is still indexing your library. Results update automatically when it finishes.'
          : hasFilters || scoped
            ? 'Try removing a filter or searching all folders.'
            : 'Check the spelling, try fewer words, or search for a phrase in quotes.'
      }
    >
      {hasFilters && (
        <Button variant="secondary" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
      {scoped && (
        <Button variant="secondary" onClick={onSearchEverywhere}>
          Search all folders
        </Button>
      )}
    </StatePanel>
  );
}

export function QueryProblem({ error, onClearFilters, hasFilters }: { error: QueryError; hasFilters: boolean; onClearFilters: () => void }) {
  return (
    <StatePanel
      icon={<AlertCircle size={20} className="text-warning" />}
      title="Echo couldn’t understand this search"
      description={
        <>
          <span className="text-fg">{error.message}</span>
          {!/quotes/i.test(error.message) && (
            <span className="mt-2 block text-xs text-fg-3">Tip: wrap text in quotes to search for it literally.</span>
          )}
        </>
      }
    >
      {hasFilters && (
        <Button variant="secondary" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </StatePanel>
  );
}

export function SearchFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <StatePanel
      icon={<AlertCircle size={20} className="text-danger" />}
      title="Search didn’t complete"
      description="Something went wrong while searching. Your index is unaffected."
    >
      <Button variant="secondary" icon={<RotateCw size={14} />} onClick={onRetry}>
        Try again
      </Button>
    </StatePanel>
  );
}

export function NoLibrary({ onAddFolder }: { onAddFolder: () => void }) {
  return (
    <StatePanel
      icon={<EchoMark size={20} />}
      title="Echo has no folders to search yet"
      description="Add a folder to your library and its files become searchable in moments."
    >
      <Button variant="primary" icon={<FolderPlus size={15} />} onClick={onAddFolder}>
        Add folder
      </Button>
    </StatePanel>
  );
}

/** Placeholder rows shaped like real results. */
export function ResultSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-1 px-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3 px-3 py-3" style={{ opacity: 1 - i * 0.15 }}>
          <div className="skeleton h-8 w-8 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="skeleton h-3.5" style={{ width: `${38 + ((i * 17) % 30)}%` }} />
            <div className="skeleton h-2.5 w-1/3" />
            <div className="skeleton h-2.5" style={{ width: `${70 + ((i * 11) % 25)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
