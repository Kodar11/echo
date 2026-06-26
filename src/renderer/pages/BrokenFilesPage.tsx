import { useEffect } from 'react';
import {
  ExternalLink,
  FolderOpen,
  RefreshCw,
  Shield,
  ShieldOff,
  XCircle,
} from 'lucide-react';
import { useFailuresStore } from '../stores/failuresStore.js';
import { getBasename, getDirname } from '../lib/path.js';

const CATEGORY_LABELS: Record<string, string> = {
  corrupted: 'Corrupted file',
  encrypted: 'Encrypted file',
  permission_denied: 'Permission denied',
  locked: 'Locked file',
  unsupported: 'Unsupported format',
  extraction_failed: 'Extraction failed',
};

export function BrokenFilesPage() {
  const { failures, isLoading, loadFailures, retryFailure, setIgnored } =
    useFailuresStore();

  useEffect(() => {
    loadFailures();
  }, [loadFailures]);

  if (isLoading && failures.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm theme-text-secondary">Loading failures…</p>
      </div>
    );
  }

  if (failures.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--panel)">
          <RefreshCw size={22} className="theme-text-secondary" />
        </div>
        <div className="text-center">
          <h2 className="text-sm font-medium theme-text">No broken files</h2>
          <p className="mt-1 max-w-xs text-xs theme-text-secondary">
            Indexing failures will appear here so you can retry or ignore them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium theme-text">Broken Files</h1>
            <p className="text-xs theme-text-secondary">
              {failures.length} indexing failure{failures.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            onClick={() => loadFailures()}
            className="flex items-center gap-2 rounded-lg border border-(--border) bg-(--panel) px-3 py-1.5 text-xs font-medium theme-text-secondary transition hover:theme-text"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        <div className="space-y-2">
          {failures.map((failure) => (
            <FailureCard
              key={failure.id}
              failure={failure}
              onRetry={() => retryFailure(failure.path)}
              onToggleIgnore={() => setIgnored(failure.path, !failure.ignored)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FailureCard({
  failure,
  onRetry,
  onToggleIgnore,
}: {
  failure: IndexingFailure;
  onRetry: () => void;
  onToggleIgnore: () => void;
}) {
  return (
    <div
      className={`rounded-xl border bg-(--surface) p-4 ${
        failure.ignored ? 'border-(--border) opacity-60' : 'border-(--border)'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <XCircle size={14} className="text-red-500" />
            <p className="truncate text-sm font-medium theme-text">
              {getBasename(failure.path)}
            </p>
          </div>
          <p className="mt-0.5 truncate text-xs theme-text-secondary">
            {getDirname(failure.path)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-(--panel) px-2 py-0.5 text-[11px] font-medium theme-text-secondary">
              {CATEGORY_LABELS[failure.category] ?? failure.category}
            </span>
            <span className="text-[11px] theme-text-tertiary">
              {formatTime(failure.occurredAt)}
            </span>
          </div>
          <p className="mt-2 text-xs theme-text-secondary">{failure.message}</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onRetry}
            disabled={failure.ignored}
            className="rounded p-1.5 hover:bg-(--panel) disabled:opacity-40"
            title="Retry indexing"
          >
            <RefreshCw size={14} className="theme-text-secondary" />
          </button>
          <button
            onClick={() => window.electron.openFile({ path: failure.path })}
            className="rounded p-1.5 hover:bg-(--panel)"
            title="Open file"
          >
            <ExternalLink size={14} className="theme-text-secondary" />
          </button>
          <button
            onClick={() =>
              window.electron.openContainingFolder({ path: failure.path })
            }
            className="rounded p-1.5 hover:bg-(--panel)"
            title="Open folder"
          >
            <FolderOpen size={14} className="theme-text-secondary" />
          </button>
          <button
            onClick={onToggleIgnore}
            className="rounded p-1.5 hover:bg-(--panel)"
            title={failure.ignored ? 'Stop ignoring' : 'Ignore future indexing'}
          >
            {failure.ignored ? (
              <ShieldOff size={14} className="theme-text-secondary" />
            ) : (
              <Shield size={14} className="theme-text-secondary" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
