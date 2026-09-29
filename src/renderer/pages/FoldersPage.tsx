import { useEffect } from 'react';
import {
  FolderOpen,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useFoldersStore } from '../stores/foldersStore.js';
import { useIndexStore } from '../stores/indexStore.js';
import { EmptyState } from '../components/EmptyState.js';
import { getBasename } from '../lib/path.js';
import { Button } from '../components/ui/Button.js';
import { Toggle } from '../components/ui/Toggle.js';
import { ProgressBar } from '../components/ui/ProgressBar.js';
import { IconButton } from '../components/ui/IconButton.js';
import { PageShell } from '../components/ui/PageShell.js';

export function FoldersPage() {
  const {
    folders,
    loadFolders,
    selectFolder,
    removeFolder,
    setEnabled,
  } = useFoldersStore();
  const { startIndexing, stopIndexing, status } = useIndexStore();

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const isIndexing = status.status === 'indexing';
  const isCancelling = status.phase === 'cancelling';

  return (
    <PageShell
      title="Folders"
      subtitle="Choose which folders Echo indexes and keeps in sync"
      maxWidth="sm"
      actions={
        isIndexing ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => stopIndexing()}
            disabled={isCancelling}
          >
            <RefreshCw size={14} strokeWidth={1.8} className="animate-spin" />
            {isCancelling ? 'Stopping…' : 'Stop'}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={() => startIndexing()}>
            <RefreshCw size={14} strokeWidth={1.8} />
            Index Now
          </Button>
        )
      }
    >
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={selectFolder}
          disabled={isIndexing}
          className="flex-1 justify-start"
        >
          <Plus size={16} strokeWidth={1.8} className="theme-text-tertiary" />
          <span className="theme-text-tertiary">Add folder...</span>
        </Button>
      </div>

      {isIndexing && status.total > 0 && (
        <div className="rounded-xl border border-(--border) bg-(--surface) p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="theme-text-secondary">
              {status.currentFile
                ? `Indexing ${getBasename(status.currentFile)}`
                : 'Scanning folders...'}
            </span>
            <span className="font-medium theme-text">
              {status.processed} / {status.total}
            </span>
          </div>
          <ProgressBar
            value={status.processed}
            max={status.total}
            size="md"
            className="mt-2"
          />
        </div>
      )}

      {status.queueLength > 0 && !isIndexing && (
        <div className="flex items-center gap-2 text-xs theme-text-secondary">
          <RefreshCw size={12} className="animate-spin" />
          {status.queueLength} file{status.queueLength === 1 ? '' : 's'} pending
        </div>
      )}

      <div className="space-y-2">
        {folders.length === 0 && (
          <EmptyState
            icon={FolderOpen}
            title="No folders"
            description="Add a folder to start building your search index."
          />
        )}

        {folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            onToggle={() => setEnabled(folder.id, folder.enabled === 0)}
            onRemove={() => removeFolder(folder.id)}
          />
        ))}
      </div>
    </PageShell>
  );
}

function FolderItem({
  folder,
  onToggle,
  onRemove,
}: {
  folder: IndexedFolder;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const folderName = getBasename(folder.path);

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-transparent bg-(--surface) p-3.5 transition hover:border-(--border) hover:bg-(--panel)">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
          <FolderOpen size={18} strokeWidth={1.6} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium theme-text">
            {folderName}
          </p>
          <p className="truncate text-xs theme-text-tertiary">{folder.path}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Toggle
          checked={folder.enabled === 1}
          onChange={onToggle}
          ariaLabel={`Toggle indexing for ${folderName}`}
          size="md"
        />
        <IconButton
          onClick={onRemove}
          tooltip="Remove folder"
          variant="danger"
        >
          <Trash2 size={16} strokeWidth={1.6} />
        </IconButton>
      </div>
    </div>
  );
}
