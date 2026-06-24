import { useEffect, useRef } from 'react';
import { useFoldersStore } from '../stores/foldersStore.js';
import { useIndexStore } from '../stores/indexStore.js';

export function SettingsPage() {
  const { folders, isLoading, loadFolders, addFolder, removeFolder, setEnabled } =
    useFoldersStore();
  const { progress, startIndexing, loadStatus, setProgress } = useIndexStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFolders();
    loadStatus();

    const unsubscribe = window.electron.subscribeIndexingProgress((progress) => {
      setProgress(progress);
    });
    return () => unsubscribe();
  }, [loadFolders, loadStatus, setProgress]);

  const handleAddFolder = async () => {
    const path = inputRef.current?.value.trim();
    if (!path) return;
    await addFolder(path);
    if (inputRef.current) inputRef.current.value = '';
  };

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-12">
      <h2 className="mb-6 text-2xl font-semibold theme-text">Settings</h2>

      <section className="rounded-2xl border border-(--border) bg-(--surface) p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium theme-text">Indexed Folders</h3>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter folder path..."
            className="flex-1 rounded-xl border border-(--border) bg-(--bg) px-4 py-2.5 text-sm theme-text outline-none placeholder:text-(--muted) focus:border-(--muted)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddFolder();
            }}
          />
          <button
            onClick={handleAddFolder}
            className="rounded-xl bg-(--button) px-4 py-2.5 text-sm font-medium theme-text transition hover:bg-(--button-hover)"
          >
            Add Folder
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {isLoading && folders.length === 0 && (
            <p className="text-sm theme-muted">Loading folders…</p>
          )}
          {folders.length === 0 && !isLoading && (
            <p className="text-sm theme-muted">
              No folders indexed yet. Add one above.
            </p>
          )}
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-(--bg) px-4 py-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm theme-text">
                {folder.path}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEnabled(folder.id, folder.enabled === 0)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    folder.enabled
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-(--button) text-(--muted)'
                  }`}
                >
                  {folder.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  onClick={() => removeFolder(folder.id)}
                  className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-(--border) bg-(--surface) p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium theme-text">Indexing</h3>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm theme-text">
              {progress.status === 'running'
                ? `Indexing ${progress.currentFile ?? 'files…'}`
                : progress.status === 'completed'
                  ? 'Indexing completed'
                  : progress.status === 'error'
                    ? `Error: ${progress.error}`
                    : 'Ready to index'}
            </p>
            <p className="mt-0.5 text-xs theme-muted">
              {progress.indexedFiles} files indexed
            </p>
          </div>
          <button
            onClick={() => startIndexing()}
            disabled={progress.status === 'running'}
            className="rounded-xl bg-(--button) px-5 py-2.5 text-sm font-medium theme-text transition hover:bg-(--button-hover) disabled:opacity-50"
          >
            {progress.status === 'running' ? 'Indexing…' : 'Index Now'}
          </button>
        </div>

        {progress.status === 'running' && progress.total > 0 && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-(--bg)">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs theme-muted">
              {progress.processed} / {progress.total} ({progressPercent}%)
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
