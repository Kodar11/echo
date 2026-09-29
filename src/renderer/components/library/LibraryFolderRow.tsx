import clsx from 'clsx';
import { Folder, FolderOpen, MoreHorizontal, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { formatRelative, plural } from '../../lib/format.js';
import { getBasename } from '../../lib/path.js';
import { Menu } from '../ui/Menu.js';
import { Toggle } from '../ui/Toggle.js';
import { Tooltip } from '../ui/Tooltip.js';

interface LibraryFolderRowProps {
  folder: IndexedFolder;
  indexing: boolean;
  onToggle: (folder: IndexedFolder, enabled: boolean) => void;
  onRemove: (folder: IndexedFolder) => void;
}

export const LibraryFolderRow = memo(function LibraryFolderRow({ folder, indexing, onToggle, onRemove }: LibraryFolderRowProps) {
  const name = getBasename(folder.path);
  const enabled = folder.enabled === 1;
  const pending = enabled && !folder.lastSyncedAt;

  let meta: string;
  if (!enabled) meta = 'Paused · not searched';
  else if (pending && indexing) meta = 'Indexing…';
  else if (pending && (folder.fileCount ?? 0) > 0) meta = `${plural(folder.fileCount ?? 0, 'file')} · Partly indexed`;
  else if (pending) meta = 'Waiting to be indexed';
  else meta = `${plural(folder.fileCount ?? 0, 'file')} · Updated ${formatRelative(folder.lastSyncedAt).toLowerCase()}`;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-hover/50">
      <span
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
          enabled ? 'bg-accent-soft text-accent-text' : 'bg-hover text-fg-3'
        )}
        aria-hidden="true"
      >
        <Folder size={17} strokeWidth={1.75} />
      </span>

      <div className="min-w-0 flex-1">
        <p className={clsx('truncate text-base font-medium', enabled ? 'text-fg' : 'text-fg-2')}>{name}</p>
        <p className="truncate text-xs text-fg-3" title={folder.path}>
          {folder.path}
        </p>
      </div>

      <p
        className={clsx(
          'shrink-0 text-right text-xs tabular-nums max-[700px]:hidden',
          pending && indexing ? 'text-accent-text' : 'text-fg-3'
        )}
      >
        {meta}
      </p>

      <Tooltip label={enabled ? 'Included in search' : 'Paused'}>
        <span className="flex">
          <Toggle
            checked={enabled}
            onChange={(checked) => onToggle(folder, checked)}
            ariaLabel={`Include ${name} in search`}
          />
        </span>
      </Tooltip>

      <Menu
        label={`${name} actions`}
        width={210}
        entries={[
          {
            id: 'show',
            label: 'Show in Explorer',
            icon: <FolderOpen size={14} />,
            onSelect: () => void window.electron.openContainingFolder({ path: folder.path }),
          },
          'separator',
          {
            id: 'remove',
            label: 'Remove from library…',
            icon: <Trash2 size={14} />,
            tone: 'danger',
            onSelect: () => onRemove(folder),
          },
        ]}
        trigger={({ ref, toggle, open, ...aria }) => (
          <button
            ref={ref}
            type="button"
            onClick={toggle}
            aria-label={`More actions for ${name}`}
            {...aria}
            className={clsx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-hover hover:text-fg',
              open && 'bg-hover text-fg'
            )}
          >
            <MoreHorizontal size={16} />
          </button>
        )}
      />
    </div>
  );
});
