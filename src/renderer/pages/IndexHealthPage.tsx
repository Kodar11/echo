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
import { PageShell } from '../components/ui/PageShell.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/EmptyState.js';
import { Badge } from '../components/ui/Badge.js';

export function IndexHealthPage() {
  const { stats, isLoading, loadHealthStats } = useHealthStore();
  const { startIndexing } = useIndexStore();

  useEffect(() => {
    loadHealthStats();
  }, [loadHealthStats]);

  return (
    <PageShell
      title="Index Health"
      subtitle="Monitor the state of your search index"
      maxWidth="xl"
      isLoading={isLoading && !stats}
      loadingText="Loading health stats…"
      actions={
        <Button variant="primary" size="sm" onClick={() => startIndexing()}>
          <RefreshCw size={14} />
          Sync now
        </Button>
      }
    >
      {!stats ? (
        <EmptyState
          icon={Activity}
          title="No health data"
          description="Health information will appear once your index has been built."
        />
      ) : (
        <>
          <StatusBanner status={stats.status} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              icon={FolderOpen}
              label="Inaccessible"
              value={stats.inaccessibleFiles.toLocaleString()}
              variant={stats.inaccessibleFiles > 0 ? 'warning' : 'default'}
            />
            <StatCard
              icon={FileText}
              label="Ignored"
              value={stats.ignoredFiles.toLocaleString()}
            />
            <StatCard
              icon={FileText}
              label="Unsupported type"
              value={stats.unsupportedFiles.toLocaleString()}
            />
            <StatCard
              icon={FileText}
              label="Over size limit"
              value={stats.oversizedFiles.toLocaleString()}
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
        </>
      )}
    </PageShell>
  );
}

function StatusBanner({ status }: { status: HealthStatus }) {
  const config = {
    healthy: {
      icon: CheckCircle2,
      label: 'Healthy',
      variant: 'success' as const,
      description: 'Your index is up to date and operating normally.',
    },
    warning: {
      icon: AlertTriangle,
      label: 'Warning',
      variant: 'warning' as const,
      description: 'Review the details below for attention items.',
    },
    error: {
      icon: XCircle,
      label: 'Error',
      variant: 'danger' as const,
      description: 'Errors detected. Check the Broken Files report.',
    },
  };

  const { icon: Icon, label, variant, description } = config[status];

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Icon size={20} className={
            variant === 'success' ? 'text-(--success)' :
            variant === 'warning' ? 'text-(--warning)' :
            'text-(--danger)'
          } />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium theme-text">{label}</p>
            <Badge variant={variant}>{status}</Badge>
          </div>
          <p className="mt-0.5 text-xs theme-text-secondary">{description}</p>
        </div>
      </div>
    </Card>
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
    <Card className="p-4">
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            variant === 'warning' ? 'bg-(--warning-soft)' : 'bg-(--panel)'
          }`}
        >
          <Icon
            size={16}
            className={variant === 'warning' ? 'text-(--warning)' : 'theme-text-secondary'}
          />
        </div>
        <div>
          <p className="text-xs theme-text-secondary">{label}</p>
          <p className="text-base font-medium theme-text">{value}</p>
        </div>
      </div>
    </Card>
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
