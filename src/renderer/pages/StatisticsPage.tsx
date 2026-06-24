import { useEffect } from 'react';
import {
  BarChart3,
  Clock,
  Database,
  Files,
  FolderOpen,
  Gauge,
  Type,
} from 'lucide-react';
import { useIndexStore } from '../stores/indexStore.js';

export function StatisticsPage() {
  const { statistics, loadStatistics } = useIndexStore();

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide theme-text-tertiary">
            Overview
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={Files}
              label="Indexed Files"
              value={statistics.totalIndexedFiles.toLocaleString()}
            />
            <StatCard
              icon={FolderOpen}
              label="Indexed Folders"
              value={statistics.totalIndexedFolders.toLocaleString()}
            />
            <StatCard
              icon={Type}
              label="Unique Terms"
              value={statistics.totalUniqueTerms.toLocaleString()}
            />
            <StatCard
              icon={Database}
              label="Database Size"
              value={formatBytes(statistics.databaseSizeBytes)}
            />
            <StatCard
              icon={Clock}
              label="Last Duration"
              value={
                statistics.lastIndexDurationMs !== null
                  ? formatDuration(statistics.lastIndexDurationMs)
                  : '—'
              }
            />
            <StatCard
              icon={Gauge}
              label="Average Duration"
              value={
                statistics.averageIndexDurationMs !== null
                  ? formatDuration(statistics.averageIndexDurationMs)
                  : '—'
              }
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide theme-text-tertiary">
            History
          </h2>
          <div className="rounded-xl bg-(--surface) p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
                    <BarChart3 size={16} strokeWidth={1.6} />
                  </div>
                  <span className="text-sm theme-text-secondary">Status</span>
                </div>
                <StatusBadge status={statistics.status} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
                    <Clock size={16} strokeWidth={1.6} />
                  </div>
                  <span className="text-sm theme-text-secondary">
                    Last indexed
                  </span>
                </div>
                <span className="text-sm font-medium theme-text">
                  {statistics.lastIndexedAt
                    ? new Date(statistics.lastIndexedAt).toLocaleString()
                    : 'Never'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
                    <Gauge size={16} strokeWidth={1.6} />
                  </div>
                  <span className="text-sm theme-text-secondary">
                    Total indexing runs
                  </span>
                </div>
                <span className="text-sm font-medium theme-text">
                  {statistics.totalIndexingRuns.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Files;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-(--surface) p-4 transition hover:bg-(--panel)">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
          <Icon size={16} strokeWidth={1.6} />
        </div>
        <p className="text-xs font-medium theme-text-tertiary">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight theme-text">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: IndexStatus }) {
  const labels: Record<IndexStatus, string> = {
    never_indexed: 'Never indexed',
    indexing: 'Indexing',
    indexed: 'Indexed',
    error: 'Error',
  };

  const colors: Record<IndexStatus, string> = {
    never_indexed: 'bg-(--text-tertiary)',
    indexing: 'bg-(--accent)',
    indexed: 'bg-(--success)',
    error: 'bg-(--danger)',
  };

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-(--panel) px-2.5 py-1 text-xs font-medium theme-text-secondary">
      <span className={`h-1.5 w-1.5 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
