import { Copy, ExternalLink, FolderOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatBytes, plural } from '../../lib/format.js';
import { getBasename, getDirname } from '../../lib/path.js';
import { FileIcon } from '../FileIcon.js';
import { IconButton } from '../ui/IconButton.js';
import { Sheet } from '../ui/Sheet.js';

/** Files with identical contents, grouped. A library tool, not a destination. */
export function DuplicatesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGroups(null);
    setFailed(false);
    window.electron
      .getDuplicates()
      .then((result) => !cancelled && setGroups(result.sort((a, b) => b.wastedSpace - a.wastedSpace)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const reclaimable = groups?.reduce((sum, g) => sum + g.wastedSpace, 0) ?? 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Duplicate files"
      description={
        groups && groups.length > 0
          ? `${plural(groups.length, 'set')} of identical files · ${formatBytes(reclaimable)} could be freed`
          : 'Files in your library with identical contents.'
      }
    >
      {failed ? (
        <p className="px-5 py-10 text-center text-sm text-fg-2">Echo couldn’t check for duplicates. Try again later.</p>
      ) : groups === null ? (
        <div className="space-y-5 p-5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2.5">
              <div className="skeleton h-3 w-40" />
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-14 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-fg-3">
            <Copy size={18} />
          </span>
          <p className="mt-4 text-base font-medium text-fg">No duplicates found</p>
          <p className="mt-1 text-sm text-fg-2">Every indexed file in your library is unique.</p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {groups.map((group) => (
            <div key={group.hash} className="px-5 py-4">
              <p className="mb-2 text-xs text-fg-3">
                {group.count} copies · {formatBytes(group.files[0]?.size ?? 0)} each ·{' '}
                <span className="text-fg-2">{formatBytes(group.wastedSpace)} reclaimable</span>
              </p>
              <ul className="space-y-0.5">
                {group.files.map((file) => (
                  <li key={file.id} className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-hover">
                    <FileIcon filePath={file.path} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-fg">{getBasename(file.path)}</p>
                      <p className="truncate text-2xs text-fg-3" title={file.path}>
                        {getDirname(file.path)}
                      </p>
                    </div>
                    <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <IconButton size="sm" label="Show in folder" onClick={() => void window.electron.openContainingFolder({ path: file.path })}>
                        <FolderOpen size={14} />
                      </IconButton>
                      <IconButton size="sm" label="Open" onClick={() => void window.electron.openFile({ path: file.path }).catch(() => undefined)}>
                        <ExternalLink size={14} />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
