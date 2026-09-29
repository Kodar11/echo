import clsx from 'clsx';
import { CircleAlert, CircleCheck, EyeOff, FolderOpen, RefreshCw, RotateCw, TriangleAlert, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatBytes, formatCount, formatDuration, formatRelative, plural } from '../../lib/format.js';
import { getBasename, getDirname } from '../../lib/path.js';
import { describeFailure } from '../../lib/status.js';
import { useFailuresStore } from '../../stores/failuresStore.js';
import { useHealthStore } from '../../stores/healthStore.js';
import { useIndexStore } from '../../stores/indexStore.js';
import { humanizeError, toast } from '../../stores/toastStore.js';
import { FileIcon } from '../FileIcon.js';
import { Button } from '../ui/Button.js';
import { IconButton } from '../ui/IconButton.js';
import { Panel } from '../ui/Page.js';
import { Disclosure, KeyValueList, SettingsRow, SettingsSection, StatGrid } from './SettingsLayout.js';

const HEALTH_COPY: Record<HealthStatus, { title: string; detail: string }> = {
  healthy: { title: 'Index is healthy', detail: 'Everything in your library is indexed and searchable.' },
  warning: { title: 'Some files need attention', detail: 'Search works normally; a few files couldn’t be indexed.' },
  error: { title: 'The index has a problem', detail: 'Try Verify and Repair below, or sync your library again.' },
};

export function DiagnosticsView() {
  const stats = useHealthStore((s) => s.stats);
  const loadHealthStats = useHealthStore((s) => s.loadHealthStats);
  const loadFailures = useFailuresStore((s) => s.loadFailures);
  const running = useIndexStore((s) => s.progress.status === 'running');

  // Refresh on open and whenever an indexing run finishes.
  useEffect(() => {
    if (running) return;
    void loadHealthStats();
    void loadFailures();
  }, [running, loadHealthStats, loadFailures]);

  if (!stats) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="skeleton h-28 rounded-lg" />
        <div className="skeleton h-40 rounded-lg" />
      </div>
    );
  }

  const copy = HEALTH_COPY[stats.status];
  const StatusIcon = stats.status === 'healthy' ? CircleCheck : stats.status === 'warning' ? TriangleAlert : CircleAlert;

  return (
    <>
      <section aria-label="Index status">
        <Panel>
          <div className="flex items-start gap-3 px-4 py-4">
            <StatusIcon
              size={20}
              className={clsx(
                'mt-0.5 shrink-0',
                stats.status === 'healthy' ? 'text-success' : stats.status === 'warning' ? 'text-warning' : 'text-danger'
              )}
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-fg">{copy.title}</h3>
              <p className="mt-0.5 text-sm text-fg-2">{copy.detail}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw size={13} />}
              onClick={() => {
                void loadHealthStats();
                void loadFailures();
              }}
            >
              Refresh
            </Button>
          </div>
          <StatGrid
            items={[
              { label: 'Searchable files', value: formatCount(stats.indexedFiles) },
              { label: 'Library folders', value: formatCount(stats.totalFolders) },
              {
                label: 'Need attention',
                value: formatCount(stats.failedFiles),
                tone: stats.failedFiles > 0 ? 'warning' : undefined,
              },
              { label: 'Last synced', value: <span className="text-base">{formatRelative(stats.lastSyncedAt ?? stats.lastIndexedAt)}</span> },
            ]}
          />
        </Panel>
      </section>

      <FailuresList />

      <SettingsSection title="Index details">
        <Disclosure
          summary="Files skipped during indexing"
          meta={formatCount(stats.ignoredFiles + stats.unsupportedFiles + stats.oversizedFiles + stats.inaccessibleFiles)}
        >
          <KeyValueList
            items={[
              { label: 'Excluded by your patterns', value: formatCount(stats.ignoredFiles) },
              { label: 'File type not indexed', value: formatCount(stats.unsupportedFiles) },
              { label: 'Larger than the size limit', value: formatCount(stats.oversizedFiles) },
              { label: 'Couldn’t be accessed', value: formatCount(stats.inaccessibleFiles) },
            ]}
          />
        </Disclosure>
        <Disclosure summary="Technical details">
          <KeyValueList
            items={[
              { label: 'Database size', value: formatBytes(stats.databaseSizeBytes) },
              { label: 'Unique terms', value: formatCount(stats.totalTerms) },
              { label: 'Files tracked', value: formatCount(stats.totalFiles) },
              { label: 'Pending jobs', value: formatCount(stats.pendingJobs) },
              { label: 'Indexing runs', value: formatCount(stats.totalIndexingRuns) },
              { label: 'Last run', value: stats.lastRunStatus ?? '—' },
              { label: 'Last run duration', value: formatDuration(stats.lastIndexDurationMs) },
              { label: 'Average run duration', value: formatDuration(stats.averageIndexDurationMs) },
              { label: 'Last indexed', value: formatRelative(stats.lastIndexedAt) },
            ]}
          />
        </Disclosure>
      </SettingsSection>

      <MaintenanceTools />
    </>
  );
}

function FailuresList() {
  const failures = useFailuresStore((s) => s.failures);
  const retryFailure = useFailuresStore((s) => s.retryFailure);
  const setIgnored = useFailuresStore((s) => s.setIgnored);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);

  const active = failures.filter((f) => !f.ignored);
  const ignored = failures.filter((f) => f.ignored);
  const visible = showIgnored ? failures : active;

  const act = async (fn: () => Promise<void>, success: string) => {
    try {
      await fn();
      toast({ tone: 'success', title: success }, 2500);
    } catch (err) {
      toast({ tone: 'error', title: 'That didn’t work', description: humanizeError(err, 'Please try again.') });
    }
  };

  return (
    <SettingsSection
      title="Files that need attention"
      description={
        active.length > 0
          ? 'These files couldn’t be indexed, so their contents won’t appear in search.'
          : 'Files that can’t be indexed will be listed here.'
      }
    >
      {visible.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-fg-2">
          <CircleCheck size={16} className="text-success" />
          Every file in your library was indexed.
        </div>
      ) : (
        visible.map((failure) => (
          <div key={failure.id} className={clsx('px-4 py-3', failure.ignored && 'opacity-60')}>
            <div className="flex items-start gap-3">
              <FileIcon filePath={failure.path} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{getBasename(failure.path)}</p>
                <p className="truncate text-xs text-fg-3" title={failure.path}>
                  {getDirname(failure.path)}
                </p>
                <p className="mt-1 text-xs text-fg-2">
                  {describeFailure(failure.category)}
                  {failure.ignored ? ' · Ignored' : ''} ·{' '}
                  <button
                    type="button"
                    aria-expanded={expanded === failure.id}
                    onClick={() => setExpanded((id) => (id === failure.id ? null : failure.id))}
                    className="text-accent-text hover:underline"
                  >
                    {expanded === failure.id ? 'Hide details' : 'View details'}
                  </button>
                </p>
                {expanded === failure.id && (
                  <pre className="animate-fade-in mt-2 whitespace-pre-wrap break-all rounded-md border border-line bg-canvas px-2.5 py-2 font-mono text-2xs text-fg-2">
                    {failure.message}
                    {'\n'}
                    {`${failure.category} · attempts: ${failure.retryCount + 1} · ${formatRelative(failure.occurredAt)}`}
                  </pre>
                )}
              </div>
              <div className="flex shrink-0 items-center">
                {!failure.ignored && (
                  <IconButton size="sm" label="Try again" onClick={() => void act(() => retryFailure(failure.path), 'Retrying file')}>
                    <RotateCw size={14} />
                  </IconButton>
                )}
                <IconButton size="sm" label="Show in folder" onClick={() => void window.electron.openContainingFolder({ path: failure.path })}>
                  <FolderOpen size={14} />
                </IconButton>
                <IconButton
                  size="sm"
                  label={failure.ignored ? 'Stop ignoring' : 'Ignore this file'}
                  onClick={() =>
                    void act(
                      () => setIgnored(failure.path, !failure.ignored),
                      failure.ignored ? 'File will be indexed again' : 'File ignored'
                    )
                  }
                >
                  {failure.ignored ? <Undo2 size={14} /> : <EyeOff size={14} />}
                </IconButton>
              </div>
            </div>
          </div>
        ))
      )}
      {ignored.length > 0 && (
        <button
          type="button"
          onClick={() => setShowIgnored((s) => !s)}
          className="w-full px-4 py-2.5 text-left text-xs text-fg-3 hover:bg-hover hover:text-fg"
        >
          {showIgnored ? 'Hide ignored files' : `Show ${plural(ignored.length, 'ignored file')}`}
        </button>
      )}
    </SettingsSection>
  );
}

type ToolResult = { tone: 'success' | 'warning'; title: string; lines: string[] };

function MaintenanceTools() {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);

  const run = async (name: string, fn: () => Promise<ToolResult>) => {
    setBusy(name);
    setResult(null);
    try {
      setResult(await fn());
    } catch (err) {
      setResult({ tone: 'warning', title: `${name} didn’t complete`, lines: [humanizeError(err, 'Please try again.')] });
    } finally {
      setBusy(null);
    }
  };

  const fromIntegrity = (report: IntegrityReport, repaired: boolean): ToolResult =>
    report.healthy || (repaired && report.repaired)
      ? {
          tone: 'success',
          title: repaired && report.issues.length > 0 ? `Repaired ${plural(report.issues.length, 'issue')}` : 'No problems found',
          lines: repaired ? report.issues.map((i) => i.description) : [],
        }
      : {
          tone: 'warning',
          title: `${plural(report.issues.length, 'problem')} found`,
          lines: report.issues.map((i) => (i.details ? `${i.description} — ${i.details}` : i.description)),
        };

  const fromMaintenance = (res: MaintenanceResult): ToolResult => ({
    tone: res.success ? 'success' : 'warning',
    title: res.success ? 'Database optimized' : 'Optimization finished with warnings',
    lines: res.operations
      .filter((op) => !op.success || op.message)
      .map((op) => `${op.name}: ${op.success ? op.message ?? 'done' : op.message ?? 'failed'}`),
  });

  return (
    <SettingsSection title="Maintenance" description="Useful if search behaves unexpectedly.">
      <SettingsRow label="Verify index" description="Check the database for inconsistencies.">
        <Button
          variant="secondary"
          isLoading={busy === 'Verify'}
          disabled={busy !== null}
          onClick={() => run('Verify', async () => fromIntegrity(await window.electron.verifyIndex(), false))}
        >
          Verify
        </Button>
      </SettingsRow>
      <SettingsRow label="Repair index" description="Fix inconsistencies that Verify finds.">
        <Button
          variant="secondary"
          isLoading={busy === 'Repair'}
          disabled={busy !== null}
          onClick={() => run('Repair', async () => fromIntegrity(await window.electron.repairIndex(), true))}
        >
          Repair
        </Button>
      </SettingsRow>
      <SettingsRow label="Optimize database" description="Reclaim space and refresh query statistics.">
        <Button
          variant="secondary"
          isLoading={busy === 'Optimize'}
          disabled={busy !== null}
          onClick={() =>
            run('Optimize', async () => fromMaintenance(await window.electron.runMaintenance({ vacuum: true, analyze: true })))
          }
        >
          Optimize
        </Button>
      </SettingsRow>
      {result && (
        <div className="animate-fade-in px-4 py-3" role="status">
          <p className={clsx('flex items-center gap-2 text-sm font-medium', result.tone === 'success' ? 'text-success' : 'text-warning')}>
            {result.tone === 'success' ? <CircleCheck size={15} /> : <TriangleAlert size={15} />}
            {result.title}
          </p>
          {result.lines.length > 0 && (
            <ul className="mt-2 space-y-1 pl-6 text-xs text-fg-2">
              {result.lines.map((line, i) => (
                <li key={i} className="list-disc">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SettingsSection>
  );
}
