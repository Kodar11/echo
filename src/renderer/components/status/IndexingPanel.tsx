import { FolderPlus, Lock, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { formatCount, formatRelative } from '../../lib/format.js';
import { getBasename } from '../../lib/path.js';
import type { LibraryStatus } from '../../lib/status.js';
import { useFoldersStore } from '../../stores/foldersStore.js';
import { useIndexStore } from '../../stores/indexStore.js';
import { useNavStore } from '../../stores/navStore.js';
import { addFolderWithFeedback, cancelIndexingWithFeedback } from '../../lib/actions.js';
import { EchoPulse } from '../brand/EchoRipple.js';
import { Button } from '../ui/Button.js';
import { ProgressBar } from '../ui/ProgressBar.js';

interface IndexingPanelProps {
  status: LibraryStatus;
  /** Called before navigating elsewhere (closes the popover). */
  onNavigate: () => void;
}

export function IndexingPanel({ status, onNavigate }: IndexingPanelProps) {
  const progress = useIndexStore((s) => s.progress);
  const indexedFiles = useIndexStore((s) => s.statistics.totalIndexedFiles);
  const lastIndexedAt = useIndexStore((s) => s.statistics.lastIndexedAt);
  const startIndexing = useIndexStore((s) => s.startIndexing);
  const folderCount = useFoldersStore((s) => s.folders.length);
  const navigate = useNavStore((s) => s.navigate);
  const openSettings = useNavStore((s) => s.openSettings);
  const [busy, setBusy] = useState(false);

  const cancelling = progress.phase === 'cancelling';

  const cancel = async () => {
    setBusy(true);
    try {
      await cancelIndexingWithFeedback();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5">
          <EchoPulse tone={status.tone} pulsing={status.running} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-fg">{status.title}</h2>
          <p className="mt-0.5 text-xs text-fg-2">{status.detail}</p>
        </div>
      </div>

      {status.running && (
        <div className="mt-4">
          <ProgressBar value={status.fraction} label="Indexing progress" />
          <div className="mt-2 flex items-center justify-between gap-3 text-xs tabular-nums text-fg-2">
            <span>
              {progress.total > 0
                ? `${formatCount(Math.min(progress.processed, progress.total))} of ${formatCount(progress.total)} files`
                : 'Preparing…'}
            </span>
            {status.fraction !== null && <span className="text-fg-3">{Math.round(status.fraction * 100)}%</span>}
          </div>
          {progress.currentFile && (
            <p className="mt-1 truncate text-xs text-fg-3" title={progress.currentFile}>
              {getBasename(progress.currentFile)}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <Button size="sm" variant="secondary" onClick={cancel} isLoading={busy || cancelling} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </Button>
          </div>
        </div>
      )}

      {!status.running && folderCount === 0 && (
        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="primary" icon={<FolderPlus size={14} />} onClick={addFolderWithFeedback}>
            Add folder
          </Button>
        </div>
      )}

      {!status.running && folderCount > 0 && (
        <>
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-1.5 text-xs">
            <dt className="text-fg-3">Searchable files</dt>
            <dd className="text-right tabular-nums text-fg">{formatCount(indexedFiles)}</dd>
            <dt className="text-fg-3">Last updated</dt>
            <dd className="text-right text-fg">{formatRelative(lastIndexedAt)}</dd>
          </dl>
          {status.tone === 'warning' && (
            <button
              type="button"
              onClick={() => {
                onNavigate();
                openSettings('diagnostics');
              }}
              className="mt-3 w-full rounded-md bg-warning-soft px-3 py-2 text-left text-xs text-fg hover:brightness-105"
            >
              <span className="font-medium">Review files that need attention</span>
              <span className="text-fg-2"> — see why they couldn’t be indexed.</span>
            </button>
          )}
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onNavigate();
                navigate('library');
              }}
            >
              Manage library
            </Button>
            <Button size="sm" variant="secondary" icon={<RefreshCw size={13} />} onClick={() => void startIndexing()}>
              Sync now
            </Button>
          </div>
        </>
      )}

      <p className="mt-4 flex items-center gap-1.5 border-t border-line pt-3 text-2xs text-fg-3">
        <Lock size={11} />
        Your index stays on this computer.
      </p>
    </div>
  );
}
