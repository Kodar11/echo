import { ChevronRight, Copy, EyeOff, FolderPlus, Lock, RefreshCw, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { DuplicatesSheet } from '../components/library/DuplicatesSheet.js';
import { LibraryFolderRow } from '../components/library/LibraryFolderRow.js';
import { Button } from '../components/ui/Button.js';
import { ConfirmDialog } from '../components/ui/Dialog.js';
import { Page, Panel, Section } from '../components/ui/Page.js';
import { ProgressBar } from '../components/ui/ProgressBar.js';
import { useLibraryStatus } from '../components/status/useLibraryStatus.js';
import { formatCount, plural } from '../lib/format.js';
import { getBasename } from '../lib/path.js';
import { useFailuresStore } from '../stores/failuresStore.js';
import { useFoldersStore } from '../stores/foldersStore.js';
import { useIndexStore } from '../stores/indexStore.js';
import { useNavStore } from '../stores/navStore.js';
import { humanizeError, toast } from '../stores/toastStore.js';
import { addFolderWithFeedback, cancelIndexingWithFeedback } from '../lib/actions.js';

export function LibraryPage() {
  const folders = useFoldersStore((s) => s.folders);
  const loaded = useFoldersStore((s) => s.loaded);
  const loadFolders = useFoldersStore((s) => s.loadFolders);
  const removeFolder = useFoldersStore((s) => s.removeFolder);
  const setEnabled = useFoldersStore((s) => s.setEnabled);
  const progress = useIndexStore((s) => s.progress);
  const startIndexing = useIndexStore((s) => s.startIndexing);
  const failures = useFailuresStore((s) => s.failures);
  const loadFailures = useFailuresStore((s) => s.loadFailures);
  const openSettings = useNavStore((s) => s.openSettings);
  const status = useLibraryStatus();

  const [removing, setRemoving] = useState<IndexedFolder | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);

  const running = progress.status === 'running';
  const cancelling = progress.phase === 'cancelling';
  const attention = failures.filter((f) => !f.ignored).length;

  useEffect(() => {
    void loadFolders();
    void loadFailures();
  }, [loadFolders, loadFailures]);

  const onToggle = useCallback(async (folder: IndexedFolder, enabled: boolean) => {
    try {
      await setEnabled(folder.id, enabled);
    } catch (err) {
      toast({ tone: 'error', title: 'Couldn’t update folder', description: humanizeError(err, 'Please try again.') });
    }
  }, [setEnabled]);

  const onRemove = useCallback((folder: IndexedFolder) => setRemoving(folder), []);

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await removeFolder(removing.id);
      toast({ tone: 'neutral', title: 'Folder removed', description: `${getBasename(removing.path)} is no longer searched.` });
      setRemoving(null);
    } catch (err) {
      toast({ tone: 'error', title: 'Couldn’t remove folder', description: humanizeError(err, 'Please try again.') });
    } finally {
      setRemoveBusy(false);
    }
  };

  const totalFiles = folders.reduce((sum, f) => sum + (f.enabled ? (f.fileCount ?? 0) : 0), 0);

  return (
    <Page
      title="Library"
      description={
        loaded && folders.length > 0
          ? `Echo searches ${plural(totalFiles, 'file')} across ${plural(folders.filter((f) => f.enabled).length, 'folder')}.`
          : 'The folders Echo searches.'
      }
      actions={
        folders.length > 0 && (
          <>
            {!running && (
              <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={() => void startIndexing()}>
                Sync now
              </Button>
            )}
            <Button variant="primary" icon={<FolderPlus size={15} />} onClick={addFolderWithFeedback}>
              Add folder
            </Button>
          </>
        )
      }
    >
      {running && (
        <div className="animate-fade-in mb-4 rounded-lg border border-line bg-surface px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">{status.title}</p>
              <p className="truncate text-xs tabular-nums text-fg-3">
                {progress.total > 0
                  ? `${formatCount(Math.min(progress.processed, progress.total))} of ${formatCount(progress.total)} files`
                  : status.detail}
                {progress.currentFile && ` · ${getBasename(progress.currentFile)}`}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={cancelling}
              onClick={() => void cancelIndexingWithFeedback()}
            >
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </Button>
          </div>
          <ProgressBar className="mt-2.5" value={status.fraction} label="Indexing progress" />
        </div>
      )}

      {!loaded ? (
        <Panel>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3" aria-hidden="true">
              <div className="skeleton h-9 w-9 rounded-md" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-32" />
                <div className="skeleton h-2.5 w-64" />
              </div>
            </div>
          ))}
        </Panel>
      ) : folders.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-14 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-text">
            <FolderPlus size={20} />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-fg">Your library is empty</h2>
          <p className="mt-1 max-w-sm text-sm text-fg-2">
            Add the folders you want to search — Documents, projects, notes. Echo keeps them indexed as files change.
          </p>
          <Button className="mt-5" variant="primary" icon={<FolderPlus size={15} />} onClick={addFolderWithFeedback}>
            Add folder
          </Button>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-fg-3">
            <Lock size={12} />
            Your index stays on this computer.
          </p>
        </div>
      ) : (
        <Panel>
          {folders.map((folder) => (
            <LibraryFolderRow key={folder.id} folder={folder} indexing={running} onToggle={onToggle} onRemove={onRemove} />
          ))}
        </Panel>
      )}

      {loaded && folders.length > 0 && (
        <Section title="Maintenance">
          <Panel>
            {attention > 0 && (
              <ToolRow
                icon={<TriangleAlert size={16} className="text-warning" />}
                title={`${plural(attention, 'file')} couldn’t be indexed`}
                description="See why, retry, or ignore them."
                onClick={() => openSettings('diagnostics')}
              />
            )}
            <ToolRow
              icon={<Copy size={16} />}
              title="Find duplicate files"
              description="Files with identical contents across your library."
              onClick={() => setDuplicatesOpen(true)}
            />
            <ToolRow
              icon={<EyeOff size={16} />}
              title="Excluded files and folders"
              description="Skip patterns like node_modules or *.tmp."
              onClick={() => openSettings('indexing')}
            />
          </Panel>
        </Section>
      )}

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        isBusy={removeBusy}
        title={`Remove “${removing ? getBasename(removing.path) : ''}” from your library?`}
        description="Echo will stop searching this folder and remove its files from the index. Your files themselves aren’t touched."
        confirmLabel="Remove folder"
      />
      <DuplicatesSheet open={duplicatesOpen} onClose={() => setDuplicatesOpen(false)} />
    </Page>
  );
}

function ToolRow({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-fg-3">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block text-xs text-fg-3">{description}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-fg-3" />
    </button>
  );
}
