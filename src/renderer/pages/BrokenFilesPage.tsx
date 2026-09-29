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
import { PageShell } from '../components/ui/PageShell.js';
import { EmptyState } from '../components/EmptyState.js';
import { Button } from '../components/ui/Button.js';
import { IconButton } from '../components/ui/IconButton.js';
import { Badge } from '../components/ui/Badge.js';

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

  const subtitle =
    failures.length > 0
      ? `${failures.length} indexing failure${failures.length === 1 ? '' : 's'}`
      : 'Indexing failures will appear here';

  return (
    <PageShell
      title="Broken Files"
      subtitle={subtitle}
      maxWidth="xl"
      isLoading={isLoading && failures.length === 0}
      loadingText="Loading failures…"
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => loadFailures()}
          disabled={isLoading}
        >
          <RefreshCw size={13} />
          Refresh
        </Button>
      }
    >
      {failures.length === 0 && !isLoading ? (
        <EmptyState
          icon={RefreshCw}
          title="No broken files"
          description="Indexing failures will appear here so you can retry or ignore them."
        />
      ) : (
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
      )}
    </PageShell>
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
      className={`rounded-xl border bg-(--surface) p-4 transition ${
        failure.ignored
          ? 'border-(--border) opacity-60'
          : 'border-(--border) hover:border-(--border-strong)'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <XCircle size={14} className="text-(--danger)" />
            <p className="truncate text-sm font-medium theme-text">
              {getBasename(failure.path)}
            </p>
          </div>
          <p className="mt-0.5 truncate text-xs theme-text-secondary">
            {getDirname(failure.path)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={failure.ignored ? 'default' : 'danger'}>
              {CATEGORY_LABELS[failure.category] ?? failure.category}
            </Badge>
            <span className="text-micro theme-text-tertiary">
              {formatTime(failure.occurredAt)}
            </span>
          </div>
          <p className="mt-2 text-xs theme-text-secondary">{failure.message}</p>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            onClick={onRetry}
            disabled={failure.ignored}
            tooltip="Retry indexing"
          >
            <RefreshCw size={14} className="theme-text-secondary" />
          </IconButton>
          <IconButton
            onClick={() => window.electron.openFile({ path: failure.path })}
            tooltip="Open file"
          >
            <ExternalLink size={14} className="theme-text-secondary" />
          </IconButton>
          <IconButton
            onClick={() =>
              window.electron.openContainingFolder({ path: failure.path })
            }
            tooltip="Open folder"
          >
            <FolderOpen size={14} className="theme-text-secondary" />
          </IconButton>
          <IconButton
            onClick={onToggleIgnore}
            tooltip={
              failure.ignored ? 'Stop ignoring' : 'Ignore future indexing'
            }
          >
            {failure.ignored ? (
              <ShieldOff size={14} className="theme-text-secondary" />
            ) : (
              <Shield size={14} className="theme-text-secondary" />
            )}
          </IconButton>
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
