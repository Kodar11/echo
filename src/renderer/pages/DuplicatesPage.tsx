import { useEffect, useState } from 'react';
import { Copy, ExternalLink, FileText, FolderOpen } from 'lucide-react';
import { getBasename, getDirname } from '../lib/path.js';
import { formatBytes } from '../lib/format.js';

export function DuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    window.electron
      .getDuplicates()
      .then((result) => {
        if (!cancelled) setGroups(result);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm theme-text-secondary">Scanning for duplicates…</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--panel)">
          <Copy size={22} strokeWidth={1.5} className="theme-text-secondary" />
        </div>
        <div className="text-center">
          <h2 className="text-sm font-medium theme-text">No duplicates found</h2>
          <p className="mt-1 max-w-xs text-xs theme-text-secondary">
            Echo compares file contents by hash. Add more folders and index them
            to find duplicate files.
          </p>
        </div>
      </div>
    );
  }

  const totalWasted = groups.reduce((sum, g) => sum + g.wastedSpace, 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-lg font-medium theme-text">
              {groups.length} duplicate group{groups.length === 1 ? '' : 's'}
            </h1>
            <p className="text-xs theme-text-secondary">
              {formatBytes(totalWasted)} potentially recoverable
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {groups.map((group) => (
            <DuplicateGroupCard key={group.hash} group={group} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DuplicateGroupCard({ group }: { group: DuplicateGroup }) {
  const hashPreview = `${group.hash.slice(0, 12)}…${group.hash.slice(-8)}`;

  return (
    <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
            <Copy size={14} strokeWidth={1.7} />
          </div>
          <div>
            <p className="text-xs font-medium theme-text">{hashPreview}</p>
            <p className="text-[11px] theme-text-secondary">
              {group.count} copies · {formatBytes(group.totalSize)} total ·{' '}
              {formatBytes(group.wastedSpace)} wasted
            </p>
          </div>
        </div>
      </div>

      <ul className="space-y-1.5">
        {group.files.map((file) => (
          <li
            key={file.id}
            className="group flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-(--panel)"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <FileText size={15} strokeWidth={1.6} className="theme-text-tertiary" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium theme-text">
                  {getBasename(file.path)}
                </p>
                <p className="truncate text-[11px] theme-text-secondary">
                  {getDirname(file.path)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] theme-text-tertiary">
                {formatBytes(file.size)}
              </span>
              <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => window.electron.openFile({ path: file.path })}
                  className="rounded p-1 hover:bg-(--surface)"
                  title="Open file"
                >
                  <ExternalLink size={13} strokeWidth={1.7} className="theme-text-secondary" />
                </button>
                <button
                  onClick={() =>
                    window.electron.openContainingFolder({ path: file.path })
                  }
                  className="rounded p-1 hover:bg-(--surface)"
                  title="Open folder"
                >
                  <FolderOpen size={13} strokeWidth={1.7} className="theme-text-secondary" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
