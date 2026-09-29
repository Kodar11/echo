import { useEffect } from 'react';
import {
  Activity,
  BarChart3,
  Copy,
  FileWarning,
  FolderOpen,
  Search,
  Settings,
} from 'lucide-react';
import { useIndexStore } from '../stores/indexStore.js';
import { getBasename } from '../lib/path.js';
import { ProgressBar } from './ui/ProgressBar.js';

type Page = 'search' | 'folders' | 'statistics' | 'duplicates' | 'health' | 'broken' | 'settings';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
}

const mainNavItems: { page: Page; label: string; icon: typeof Search }[] = [
  { page: 'search', label: 'Search', icon: Search },
  { page: 'folders', label: 'Folders', icon: FolderOpen },
  { page: 'statistics', label: 'Statistics', icon: BarChart3 },
  { page: 'duplicates', label: 'Duplicates', icon: Copy },
];

const systemNavItems: { page: Page; label: string; icon: typeof Search }[] = [
  { page: 'health', label: 'Health', icon: Activity },
  { page: 'broken', label: 'Broken Files', icon: FileWarning },
  { page: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({
  currentPage,
  onNavigate,
  collapsed,
}: SidebarProps) {
  const { status, statistics, loadStatus, loadStatistics } = useIndexStore();

  useEffect(() => {
    loadStatus();
    loadStatistics();
  }, [loadStatus, loadStatistics]);

  return (
    <aside
      className={`
        flex h-full shrink-0 flex-col border-r border-(--border) theme-sidebar
        overflow-hidden transition-all duration-200 ease-in-out
        ${collapsed ? 'w-14' : 'w-56'}
      `}
    >
      <nav className={`flex-1 overflow-y-auto ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
        <ul className="space-y-1">
          {mainNavItems.map((item) => (
            <NavItem
              key={item.page}
              item={item}
              isActive={currentPage === item.page}
              collapsed={collapsed}
              onClick={() => onNavigate(item.page)}
            />
          ))}
        </ul>

        {!collapsed && (
          <div className="my-3 h-px bg-(--border)" />
        )}

        <ul className="space-y-1">
          {systemNavItems.map((item) => (
            <NavItem
              key={item.page}
              item={item}
              isActive={currentPage === item.page}
              collapsed={collapsed}
              onClick={() => onNavigate(item.page)}
            />
          ))}
        </ul>
      </nav>

      <div
        className={`
          shrink-0
          ${collapsed ? 'flex justify-center p-2' : 'p-3'}
        `}
      >
        {collapsed ? (
          <StatusDot status={status.status} queueLength={status.queueLength} />
        ) : (
          <div className="rounded-xl border border-(--border) bg-(--panel) p-3">
            <StatusIndicator
              status={status.status}
              phase={status.phase}
              queueLength={status.queueLength}
              lastRunStatus={status.lastRunStatus}
              lastRunFailed={status.lastRunFailed}
            />
            {statistics.lastIndexedAt && (
              <p className="mt-1.5 text-micro theme-text-tertiary">
                Indexed {formatRelativeTime(statistics.lastIndexedAt)}
              </p>
            )}
            {status.status === 'indexing' && status.total > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-2xs theme-text-tertiary">
                  <span className="truncate pr-2">
                    {status.currentFile
                      ? getBasename(status.currentFile)
                      : PHASE_LABELS[status.phase] ?? 'Working…'}
                  </span>
                  <span>
                    {status.processed}/{status.total}
                  </span>
                </div>
                <ProgressBar
                  value={status.processed}
                  max={status.total}
                  size="sm"
                  className="mt-1.5"
                />
              </div>
            )}
            {status.queueLength > 0 && status.status !== 'indexing' && (
              <p className="mt-2 text-micro theme-text-tertiary">
                {status.queueLength} pending
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function NavItem({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: { page: Page; label: string; icon: typeof Search };
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <li className="group relative">
      <button
        onClick={onClick}
        className={`
          flex w-full items-center rounded-lg text-sm font-medium transition-all
          focus-ring
          ${
            collapsed
              ? 'h-9 w-9 justify-center p-0'
              : 'gap-3 px-3 py-2'
          }
          ${
            isActive
              ? 'bg-(--panel) theme-text shadow-sm'
              : 'theme-text-secondary hover:bg-(--panel)/60 hover:theme-text'
          }
        `}
        aria-label={item.label}
        title={collapsed ? item.label : undefined}
      >
        <Icon size={18} strokeWidth={1.6} />
        {!collapsed && (
          <span className="truncate transition-opacity duration-200">
            {item.label}
          </span>
        )}
      </button>

      {collapsed && (
        <div
          className="
            pointer-events-none absolute left-full top-1/2 z-50 ml-2
            -translate-y-1/2 whitespace-nowrap rounded-md bg-(--accent)
            px-2 py-1 text-2xs font-medium text-(--accent-foreground)
            opacity-0 transition-opacity duration-150
            group-hover:opacity-100
          "
        >
          {item.label}
        </div>
      )}
    </li>
  );
}

function StatusDot({
  status,
  queueLength,
}: {
  status: IndexStatus;
  queueLength: number;
}) {
  const color = statusColorClass(status, queueLength);
  return (
    <span
      className={`h-2.5 w-2.5 rounded-full ${color} ${
        status === 'indexing' ? 'animate-pulse' : ''
      }`}
    />
  );
}

const PHASE_LABELS: Partial<Record<IndexingPhase, string>> = {
  starting: 'Starting…',
  crawling: 'Scanning folders…',
  syncing: 'Checking for changes…',
  indexing: 'Indexing…',
  cancelling: 'Cancelling…',
  finalizing: 'Finishing…',
};

function StatusIndicator({
  status,
  phase,
  queueLength,
  lastRunStatus,
  lastRunFailed,
}: {
  status: IndexStatus;
  phase: IndexingPhase;
  queueLength: number;
  lastRunStatus: IndexingRunOutcome | null;
  lastRunFailed: number;
}) {
  const withErrors = lastRunStatus === 'completed_with_errors';
  const config: Record<IndexStatus, { label: string; color: string }> = {
    never_indexed: {
      label: 'Never indexed',
      color: 'bg-(--text-tertiary)',
    },
    indexing: { label: PHASE_LABELS[phase] ?? 'Indexing…', color: 'bg-(--accent)' },
    indexed: {
      label:
        queueLength > 0
          ? 'Syncing'
          : withErrors
            ? `Indexed · ${lastRunFailed || 'some'} failed`
            : 'Indexed',
      color:
        queueLength > 0 ? 'bg-(--accent)' : withErrors ? 'bg-(--warning)' : 'bg-(--success)',
    },
    error: { label: 'Error', color: 'bg-(--danger)' },
  };

  const { label, color } = config[status];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${color} ${
          status === 'indexing' ? 'animate-pulse' : ''
        }`}
      />
      <span className="text-xs font-medium theme-text-secondary">{label}</span>
    </div>
  );
}

function statusColorClass(status: IndexStatus, queueLength: number): string {
  switch (status) {
    case 'never_indexed':
      return 'bg-(--text-tertiary)';
    case 'indexing':
      return 'bg-(--accent)';
    case 'indexed':
      return queueLength > 0 ? 'bg-(--accent)' : 'bg-(--success)';
    case 'error':
      return 'bg-(--danger)';
  }
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
