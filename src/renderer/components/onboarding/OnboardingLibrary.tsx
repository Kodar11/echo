import clsx from 'clsx';
import { Folder, FolderPlus, Lock } from 'lucide-react';
import { useState } from 'react';
import { formatCount, plural } from '../../lib/format.js';
import { getBasename } from '../../lib/path.js';
import { useFoldersStore } from '../../stores/foldersStore.js';
import { useIndexStore } from '../../stores/indexStore.js';
import { humanizeError } from '../../stores/toastStore.js';
import { EchoPulse } from '../brand/EchoRipple.js';
import { useLibraryStatus } from '../status/useLibraryStatus.js';
import { Button } from '../ui/Button.js';
import { ProgressBar } from '../ui/ProgressBar.js';
import { OnboardingStep } from './OnboardingStep.js';

const EXAMPLE_FOLDERS = [
  { name: 'Documents', detail: 'Reports, PDFs and Word documents' },
  { name: 'Projects', detail: 'Specs, READMEs and design notes' },
  { name: 'Notes', detail: 'Markdown and plain text' },
];

/** Rows shown before "+ N more" so the step never needs to scroll. */
const MAX_ROWS = 3;

type Notice = { tone: 'neutral' | 'error'; text: string };

export function OnboardingLibrary({ onContinue }: { onContinue: () => void }) {
  const folders = useFoldersStore((s) => s.folders);
  const loaded = useFoldersStore((s) => s.loaded);
  const [choosing, setChoosing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const hasFolders = folders.length > 0;

  // The same picker and library mechanism as the Library page; adding a
  // folder starts indexing it in the background.
  const chooseFolder = async () => {
    setNotice(null);
    setChoosing(true);
    const existing = new Set(useFoldersStore.getState().folders.map((f) => f.id));
    try {
      const folder = await useFoldersStore.getState().selectFolder();
      if (folder && existing.has(folder.id)) {
        setNotice({ tone: 'neutral', text: `${getBasename(folder.path)} is already in your library.` });
      }
    } catch (err) {
      setNotice({ tone: 'error', text: `Couldn’t add that folder. ${humanizeError(err, 'Please choose another folder.')}` });
    } finally {
      setChoosing(false);
    }
  };

  return (
    <OnboardingStep
      title="Give Echo something to search."
      description="Choose the folders you want Echo to index. Your files stay on your computer."
      visual={<LibraryPreview folders={folders} loaded={loaded} />}
      actions={
        hasFolders ? (
          <>
            <Button size="lg" variant="secondary" icon={<FolderPlus size={16} />} isLoading={choosing} onClick={chooseFolder}>
              Add another folder
            </Button>
            <Button size="lg" variant="primary" className="min-w-[140px]" onClick={onContinue} data-onboarding-primary>
              Continue
            </Button>
          </>
        ) : (
          <>
            <Button
              size="lg"
              variant="primary"
              icon={<FolderPlus size={16} />}
              isLoading={choosing}
              onClick={chooseFolder}
              data-onboarding-primary
            >
              Choose folders
            </Button>
            <Button size="lg" variant="ghost" onClick={onContinue}>
              Continue
            </Button>
          </>
        )
      }
      footnote={
        <p
          aria-live="polite"
          className={clsx('flex min-h-4 items-center justify-center gap-1.5 text-xs', notice?.tone === 'error' ? 'text-danger' : 'text-fg-3')}
        >
          {notice ? (
            notice.text
          ) : (
            <>
              <Lock size={12} className="shrink-0" />
              Indexing happens on this computer. You can change folders anytime in Library.
            </>
          )}
        </p>
      }
    />
  );
}

/** The library as it will look: example folders first, then the real ones. */
function LibraryPreview({ folders, loaded }: { folders: IndexedFolder[]; loaded: boolean }) {
  const indexing = useIndexStore((s) => s.progress.status === 'running');
  const hasFolders = folders.length > 0;
  const shown = folders.slice(0, MAX_ROWS);
  const hidden = folders.length - shown.length;

  return (
    <div className="mx-auto w-full max-w-[460px] overflow-hidden rounded-lg border border-line bg-surface text-left">
      <div className="flex h-10 items-center justify-between border-b border-line px-4">
        <p className="text-sm font-semibold text-fg">Your library</p>
        <p className="text-xs text-fg-3">{hasFolders ? plural(folders.length, 'folder') : 'For example'}</p>
      </div>

      {!loaded ? (
        <div className="h-[168px]" />
      ) : hasFolders ? (
        <>
          <ul className="divide-y divide-line">
            {shown.map((folder) => (
              <FolderRow
                key={folder.id}
                name={getBasename(folder.path)}
                detail={folder.path}
                meta={folderMeta(folder, indexing)}
                active={indexing && !folder.lastSyncedAt}
              />
            ))}
          </ul>
          {hidden > 0 && <p className="border-t border-line px-4 py-2 text-xs text-fg-3">and {plural(hidden, 'more folder')}</p>}
          <LibraryProgress />
        </>
      ) : (
        <ul className="divide-y divide-line" aria-label="Example folders">
          {EXAMPLE_FOLDERS.map((folder, i) => (
            <FolderRow key={folder.name} name={folder.name} detail={folder.detail} example delay={i * 50} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FolderRow({
  name,
  detail,
  meta,
  active,
  example,
  delay = 0,
}: {
  name: string;
  detail: string;
  meta?: string;
  active?: boolean;
  example?: boolean;
  delay?: number;
}) {
  return (
    <li className="animate-rise-in flex items-center gap-3 px-4 py-2.5" style={{ animationDelay: `${delay}ms` }}>
      <span
        aria-hidden="true"
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
          example ? 'bg-hover text-fg-3' : 'bg-accent-soft text-accent-text'
        )}
      >
        <Folder size={17} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={clsx('truncate text-base font-medium', example ? 'text-fg-2' : 'text-fg')}>{name}</p>
        <p className="truncate text-xs text-fg-3" title={detail}>
          {detail}
        </p>
      </div>
      {meta && (
        <p className={clsx('shrink-0 text-xs tabular-nums max-[560px]:hidden', active ? 'text-accent-text' : 'text-fg-3')}>{meta}</p>
      )}
    </li>
  );
}

function folderMeta(folder: IndexedFolder, indexing: boolean): string {
  if (folder.enabled !== 1) return 'Paused';
  if (!folder.lastSyncedAt) return indexing ? 'Indexing…' : 'Waiting';
  return plural(folder.fileCount ?? 0, 'file');
}

/** Live indexing progress, or a quiet "ready" once the first run is done. */
function LibraryProgress() {
  const status = useLibraryStatus();
  const progress = useIndexStore((s) => s.progress);
  const indexedFiles = useIndexStore((s) => s.statistics.totalIndexedFiles);

  if (!status.running && indexedFiles === 0) return null;

  return (
    <div className="animate-fade-in border-t border-line px-4 py-3">
      {status.running ? (
        <>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <p className="text-fg-2">{status.title}</p>
            {progress.total > 0 && (
              <p className="tabular-nums text-fg-3">
                {formatCount(Math.min(progress.processed, progress.total))} / {formatCount(progress.total)}
              </p>
            )}
          </div>
          <ProgressBar className="mt-2" value={status.fraction} label="Indexing progress" />
        </>
      ) : (
        <p className="flex items-center gap-2 text-xs text-fg-3">
          <EchoPulse tone="ok" />
          {plural(indexedFiles, 'file')} ready to search
        </p>
      )}
    </div>
  );
}
