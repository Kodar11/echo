import { useEffect } from 'react';
import {
  BarChart3,
  FolderOpen,
  Search,
  Settings,
} from 'lucide-react';
import { useIndexStore } from '../stores/indexStore.js';
import { getBasename } from '../lib/path.js';

type Page = 'search' | 'folders' | 'statistics' | 'settings';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; icon: typeof Search }[] = [
  { page: 'search', label: 'Search', icon: Search },
  { page: 'folders', label: 'Folders', icon: FolderOpen },
  { page: 'statistics', label: 'Statistics', icon: BarChart3 },
  { page: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { status, statistics, loadStatus, loadStatistics } = useIndexStore();

  useEffect(() => {
    loadStatus();
    loadStatistics();
  }, [loadStatus, loadStatistics]);

  return (
    <aside className="flex h-full w-52 flex-col border-r border-(--border) theme-sidebar">
      <nav className="flex-1 px-2.5 py-4">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = currentPage === item.page;
            const Icon = item.icon;
            return (
              <li key={item.page}>
                <button
                  onClick={() => onNavigate(item.page)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-(--accent-soft) font-medium theme-text'
                      : 'theme-text-secondary hover:bg-(--panel) hover:theme-text'
                  }`}
                >
                  <Icon size={18} strokeWidth={1.7} />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-(--border) p-3">
        <StatusIndicator status={status.status} queueLength={status.queueLength} />
        {statistics.lastIndexedAt && (
          <p className="mt-1.5 text-[11px] theme-text-tertiary">
            Indexed {formatRelativeTime(statistics.lastIndexedAt)}
          </p>
        )}
        {status.status === 'indexing' && status.total > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] theme-text-tertiary">
              <span className="truncate pr-2">
                {status.currentFile
                  ? getBasename(status.currentFile)
                  : 'Scanning...'}
              </span>
              <span>
                {status.processed}/{status.total}
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-(--border-strong)">
              <div
                className="h-full rounded-full bg-(--accent) transition-all"
                style={{ width: `${(status.processed / status.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        {status.queueLength > 0 && status.status !== 'indexing' && (
          <p className="mt-1.5 text-[11px] theme-text-tertiary">
            {status.queueLength} pending
          </p>
        )}
      </div>
    </aside>
  );
}

function StatusIndicator({
  status,
  queueLength,
}: {
  status: IndexStatus;
  queueLength: number;
}) {
  const config: Record<IndexStatus, { label: string; color: string }> = {
    never_indexed: {
      label: 'Never indexed',
      color: 'bg-(--text-tertiary)',
    },
    indexing: { label: 'Indexing…', color: 'bg-(--accent)' },
    indexed: {
      label: queueLength > 0 ? 'Syncing' : 'Indexed',
      color: queueLength > 0 ? 'bg-(--accent)' : 'bg-(--success)',
    },
    error: { label: 'Error', color: 'bg-(--danger)' },
  };

  const { label, color } = config[status];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${color} ${
          status === 'indexing' ? 'animate-pulse' : ''
        }`}
      />
      <span className="text-xs font-medium theme-text-secondary">{label}</span>
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
