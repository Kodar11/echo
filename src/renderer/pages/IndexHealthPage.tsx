import { useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  FolderOpen,
  Layers,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useHealthStore } from '../stores/healthStore.js';
import { useIndexStore } from '../stores/indexStore.js';
import { formatBytes } from '../lib/format.js';

export function IndexHealthPage() {
  const { stats, isLoading, loadHealthStats } = useHealthStore();
  const { startIndexing } = useIndexStore();

  useEffect(() => {
    loadHealthStats();
  }, [loadHealthStats]);

  if (isLoading && !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm theme-text-secondary">Loading health stats…</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm theme-text-secondary">No health data available.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium theme-text">Index Health</h1>
            <p className="text-xs theme-text-secondary">
              Monitor the state of your search index
            </p>
          </div>
          <button
            onClick={() => startIndexing()}
            className="flex items-center gap-2 rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-white transition hover:bg-(--accent-hover)"
          >
            <RefreshCw size={14} />
            Sync now
          </button>
        </div>

        <StatusBanner status={stats.status} />

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={FileText}
            label="Indexed files"
            value={stats.indexedFiles.toLocaleString()}
          />
          <StatCard
            icon={FolderOpen}
            label="Folders"
            value={stats.totalFolders.toLocaleString()}
          />
          <StatCard
            icon={Layers}
            label="Unique terms"
            value={stats.totalTerms.toLocaleString()}
          />
          <StatCard
            icon={Database}
            label="Database size"
            value={formatBytes(stats.databaseSizeBytes)}
          />
          <StatCard
            icon={Activity}
            label="Failed files"
            value={stats.failedFiles.toLocaleString()}
            variant={stats.failedFiles > 0 ? 'warning' : 'default'}
          />
          <StatCard
            icon={Clock}
            label="Pending jobs"
            value={stats.pendingJobs.toLocaleString()}
            variant={stats.pendingJobs > 0 ? 'warning' : 'default'}
          />
          <StatCard
            icon={Clock}
            label="Last indexed"
            value={formatTime(stats.lastIndexedAt)}
          />
          <StatCard
            icon={Clock}
            label="Last synced"
            value={formatTime(stats.lastSyncedAt)}
          />
        </div>
      </div>
    </div>
  );
}

function StatusBanner({ status }: { status: HealthStatus }) {
  const config = {
    healthy: {
      icon: CheckCircle2,
      label: 'Healthy',
      class: 'bg-green-500/10 text-green-600 border-green-500/20',
    },
    warning: {
      icon: AlertTriangle,
      label: 'Warning',
      class: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    },
    error: {
      icon: XCircle,
      label: 'Error',
      class: 'bg-red-500/10 text-red-600 border-red-500/20',
    },
  };

  const { icon: Icon, label, class: className } = config[status];

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${className}`}
    >
      <Icon size={20} />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs opacity-80">
          {status === 'healthy'
            ? 'Your index is up to date and operating normally.'
            : status === 'warning'
            ? 'Review the details below for attention items.'
            : 'Errors detected. Check the Broken Files report.'}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  variant = 'default',
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  variant?: 'default' | 'warning';
}) {
  return (
    <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            variant === 'warning' ? 'bg-yellow-500/10' : 'bg-(--panel)'
          }`}
        >
          <Icon
            size={16}
            className={variant === 'warning' ? 'text-yellow-600' : 'theme-text-secondary'}
          />
        </div>
        <div>
          <p className="text-xs theme-text-secondary">{label}</p>
          <p className="text-base font-medium theme-text">{value}</p>
        </div>
      </div>
    </div>
  );
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
