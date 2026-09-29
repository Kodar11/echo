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
import { PageShell } from '../components/ui/PageShell.js';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { formatBytes } from '../lib/format.js';

export function StatisticsPage() {
  const { statistics, loadStatistics } = useIndexStore();

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  return (
    <PageShell
      title="Statistics"
      subtitle="Overview of your search index"
      maxWidth="lg"
      isLoading={!statistics}
      loadingText="Loading statistics…"
    >
      <section>
        <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wider theme-text-tertiary">
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
        <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wider theme-text-tertiary">
          History
        </h2>
        <Card className="p-5">
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
                <span className="text-sm theme-text-secondary">Last indexed</span>
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
                <span className="text-sm theme-text-secondary">Total indexing runs</span>
              </div>
              <span className="text-sm font-medium theme-text">
                {statistics.totalIndexingRuns.toLocaleString()}
              </span>
            </div>
          </div>
        </Card>
      </section>
    </PageShell>
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
    <Card className="p-4 transition hover:bg-(--panel)">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
          <Icon size={16} strokeWidth={1.6} />
        </div>
        <p className="text-xs font-medium theme-text-tertiary">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight theme-text">
        {value}
      </p>
    </Card>
  );
}

function StatusBadge({ status }: { status: IndexStatus }) {
  const labels: Record<IndexStatus, string> = {
    never_indexed: 'Never indexed',
    indexing: 'Indexing',
    indexed: 'Indexed',
    error: 'Error',
  };

  const variants: Record<IndexStatus, 'default' | 'accent' | 'success' | 'danger'> = {
    never_indexed: 'default',
    indexing: 'accent',
    indexed: 'success',
    error: 'danger',
  };

  return (
    <Badge variant={variants[status]} className="rounded-full px-2.5 py-1">
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
        status === 'never_indexed' ? 'bg-(--text-tertiary)' :
        status === 'indexing' ? 'bg-(--accent)' :
        status === 'indexed' ? 'bg-(--success)' :
        'bg-(--danger)'
      }`} />
      {labels[status]}
    </Badge>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
