import { useEffect, useState } from 'react';
import { Copy, ExternalLink, FileText, FolderOpen, RefreshCw } from 'lucide-react';
import { getBasename, getDirname } from '../lib/path.js';
import { formatBytes } from '../lib/format.js';
import { PageShell } from '../components/ui/PageShell.js';
import { EmptyState } from '../components/EmptyState.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { IconButton } from '../components/ui/IconButton.js';

export function DuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDuplicates = () => {
    setIsLoading(true);
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
  };

  useEffect(() => {
    const cleanup = loadDuplicates();
    return cleanup;
  }, []);

  const totalWasted = groups.reduce((sum, g) => sum + g.wastedSpace, 0);

  const subtitle = groups.length > 0
    ? `${formatBytes(totalWasted)} potentially recoverable`
    : 'Find duplicate files across indexed folders';

  return (
    <PageShell
      title={groups.length > 0 ? `${groups.length} duplicate group${groups.length === 1 ? '' : 's'}` : 'Duplicates'}
      subtitle={subtitle}
      maxWidth="lg"
      isLoading={isLoading}
      loadingText="Scanning for duplicates…"
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={loadDuplicates}
          disabled={isLoading}
        >
          <RefreshCw size={13} />
          Refresh
        </Button>
      }
    >
      {groups.length === 0 && !isLoading ? (
        <EmptyState
          icon={Copy}
          title="No duplicates found"
          description="Echo compares file contents by hash. Add more folders and index them to find duplicate files."
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <DuplicateGroupCard key={group.hash} group={group} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function DuplicateGroupCard({ group }: { group: DuplicateGroup }) {
  const hashPreview = `${group.hash.slice(0, 12)}…${group.hash.slice(-8)}`;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
            <Copy size={14} strokeWidth={1.7} />
          </div>
          <div>
            <p className="text-xs font-medium theme-text">{hashPreview}</p>
            <p className="text-micro theme-text-secondary">
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
                <p className="truncate text-micro theme-text-secondary">
                  {getDirname(file.path)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-micro theme-text-tertiary">
                {formatBytes(file.size)}
              </span>
              <div className="flex items-center gap-1">
                <IconButton
                  onClick={() => window.electron.openFile({ path: file.path })}
                  tooltip="Open file"
                  className="h-7 w-7"
                >
                  <ExternalLink size={13} strokeWidth={1.7} />
                </IconButton>
                <IconButton
                  onClick={() =>
                    window.electron.openContainingFolder({ path: file.path })
                  }
                  tooltip="Open folder"
                  className="h-7 w-7"
                >
                  <FolderOpen size={13} strokeWidth={1.7} />
                </IconButton>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
