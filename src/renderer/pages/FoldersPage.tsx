import { useEffect } from 'react';
import {
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useFoldersStore } from '../stores/foldersStore.js';
import { useIndexStore } from '../stores/indexStore.js';
import { EmptyState } from '../components/EmptyState.js';
import { getBasename } from '../lib/path.js';

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

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={selectFolder}
            disabled={isIndexing}
            className="inline-flex flex-1 items-center gap-2 rounded-xl border border-(--border-strong) bg-(--surface) px-4 py-2.5 text-left text-sm theme-text transition hover:bg-(--panel) disabled:opacity-50"
          >
            <FolderOpen size={16} strokeWidth={1.8} className="theme-text-tertiary" />
            <span className="theme-text-tertiary">Browse for a folder...</span>
          </button>
          {isIndexing ? (
            <button
              onClick={() => stopIndexing()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-(--danger) px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              <RefreshCw
                size={14}
                strokeWidth={1.8}
                className="animate-spin"
              />
              Stop
            </button>
          ) : (
            <button
              onClick={() => startIndexing()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-(--accent) px-4 py-2.5 text-sm font-medium text-white transition hover:bg-(--accent-hover) dark:text-black"
            >
              <RefreshCw size={14} strokeWidth={1.8} />
              Index Now
            </button>
          )}
        </div>

        {isIndexing && status.total > 0 && (
          <div className="mt-4 rounded-xl border border-(--border) bg-(--surface) p-3">
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
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-(--border-strong)">
              <div
                className="h-full rounded-full bg-(--accent) transition-all"
                style={{
                  width: `${status.total > 0 ? (status.processed / status.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {status.queueLength > 0 && !isIndexing && (
          <div className="mt-4 flex items-center gap-2 text-xs theme-text-secondary">
            <Loader2 size={12} className="animate-spin" />
            {status.queueLength} file{status.queueLength === 1 ? '' : 's'} pending
          </div>
        )}

        <div className="mt-8 space-y-2">
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
      </div>
    </div>
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
    <div className="flex items-center justify-between gap-4 rounded-xl bg-(--surface) p-3.5 transition hover:bg-(--panel)">
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
        <Toggle checked={folder.enabled === 1} onChange={onToggle} />
        <button
          onClick={onRemove}
          className="rounded-lg p-2 theme-text-tertiary transition hover:bg-(--panel) hover:text-(--danger)"
          aria-label="Remove folder"
        >
          <Trash2 size={16} strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={`relative h-5 w-9 rounded-full transition ${
        checked ? 'bg-(--accent)' : 'bg-(--border-strong)'
      }`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform dark:bg-black ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
