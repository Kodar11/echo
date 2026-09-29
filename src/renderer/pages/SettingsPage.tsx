import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Bug,
  CheckCircle2,
  Database,
  Eye,
  FileSearch,
  Filter,
  FolderOpen,
  FolderX,
  HardDrive,
  Info,
  Languages,
  Monitor,
  Moon,
  RefreshCw,
  Save,
  Search,
  Shield,
  Sun,
  Trash2,
  Upload,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  type ThemePreference,
  useThemeStore,
} from '../stores/themeStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';
import { useIgnoreRulesStore } from '../stores/ignoreRulesStore.js';
import { useBackupStore } from '../stores/backupStore.js';
import { useHealthStore } from '../stores/healthStore.js';
import { useIndexStore } from '../stores/indexStore.js';
import { formatBytes } from '../lib/format.js';
import { PageShell } from '../components/ui/PageShell.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Toggle } from '../components/ui/Toggle.js';
import { Badge } from '../components/ui/Badge.js';
import { IconButton } from '../components/ui/IconButton.js';
import { Collapsible } from '../components/ui/Collapsible.js';
import { SettingRow } from '../components/ui/SettingRow.js';

const FILE_SIZE_OPTIONS: { label: string; value: number }[] = [
  { label: 'Unlimited', value: 0 },
  { label: '10 MB', value: 10 * 1024 * 1024 },
  { label: '100 MB', value: 100 * 1024 * 1024 },
  { label: '500 MB', value: 500 * 1024 * 1024 },
  { label: '1 GB', value: 1024 * 1024 * 1024 },
];

const EXTRACTOR_OPTIONS: { id: ExtractorId; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'DOCX' },
  { id: 'html', label: 'HTML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'text', label: 'Text' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const INDEXING_MODE_OPTIONS: { value: IndexingMode; label: string }[] = [
  { value: 'immediate', label: 'Index immediately (watch folders)' },
  { value: 'startup', label: 'Index only on startup' },
  { value: 'scheduled', label: 'Scheduled indexing' },
  { value: 'manual', label: 'Manual only' },
];

const SCHEDULE_OPTIONS: { value: ScheduleInterval; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
];

const MIGRATION_OPTIONS: { value: 'auto' | 'prompt' | 'block'; label: string }[] = [
  { value: 'auto', label: 'Apply automatically' },
  { value: 'prompt', label: 'Prompt before migrating' },
  { value: 'block', label: 'Block until manual action' },
];

const RECOVERY_OPTIONS: { value: 'auto' | 'notify' | 'manual'; label: string }[] = [
  { value: 'auto', label: 'Recover automatically' },
  { value: 'notify', label: 'Notify and wait' },
  { value: 'manual', label: 'Manual only' },
];

export function SettingsPage() {
  const preference = useThemeStore((state) => state.preference);
  const persistPreference = useThemeStore((state) => state.persistPreference);
  const { settings, loadSettings, setSetting } = useSettingsStore();
  const { rules, loadRules, addRule, setEnabled, deleteRule } =
    useIgnoreRulesStore();
  const {
    isExporting,
    isImporting,
    lastResult,
    exportBackup,
    importBackup,
    clearResult,
  } = useBackupStore();
  const [newRule, setNewRule] = useState('');
  const [customSize, setCustomSize] = useState('');
  const [verifyReport, setVerifyReport] = useState<IntegrityReport | null>(null);
  const [repairReport, setRepairReport] = useState<IntegrityReport | null>(null);
  const [maintenanceResult, setMaintenanceResult] = useState<MaintenanceResult | null>(null);
  const [isRunningMaintenance, setIsRunningMaintenance] = useState(false);

  useEffect(() => {
    loadSettings();
    loadRules();
  }, [loadSettings, loadRules]);

  const handleThemeChange = (value: ThemePreference) => {
    persistPreference(value);
  };

  const handleFileSizeChange = (value: number) => {
    setSetting('maxFileSizeBytes', value);
    setCustomSize('');
  };

  const handleCustomSizeChange = (value: string) => {
    setCustomSize(value);
    const bytes = parseFileSize(value);
    if (bytes !== null) {
      setSetting('maxFileSizeBytes', bytes);
    }
  };

  const handleExport = async () => {
    clearResult();
    const result = await window.electron.selectFolder();
    if (result) {
      await exportBackup(result);
    }
  };

  const handleImport = async () => {
    clearResult();
    const result = await window.electron.selectFile();
    if (result) {
      await importBackup(result);
    }
  };

  const handleVerify = async () => {
    setRepairReport(null);
    const report = await window.electron.verifyIndex();
    setVerifyReport(report);
  };

  const handleRepair = async () => {
    setVerifyReport(null);
    const report = await window.electron.repairIndex();
    setRepairReport(report);
  };

  const handleResetDatabase = async () => {
    const confirmed = window.confirm(
      'Reset the database?\n\nThis deletes the whole index, your indexed folders, ignore rules and settings, and starts from an empty database. This cannot be undone.'
    );
    if (!confirmed) return;
    setVerifyReport(null);
    setRepairReport(null);
    await useIndexStore.getState().resetDatabase();
    window.location.reload();
  };

  const handleMaintenance = async (options: { vacuum?: boolean }) => {
    setIsRunningMaintenance(true);
    try {
      const result = await window.electron.runMaintenance(options);
      setMaintenanceResult(result);
    } finally {
      setIsRunningMaintenance(false);
    }
  };

  return (
    <PageShell title="Settings" subtitle="Customize Echo to fit your workflow" maxWidth="2xl">
      <IndexHealthHeader />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Collapsible title="Appearance" subtitle="Choose your preferred color scheme">
          <SettingRow label="Theme" description="Light, dark, or follow your system">
            <Select
              value={preference}
              options={THEME_OPTIONS}
              onChange={(value) => handleThemeChange(value as ThemePreference)}
              className="w-40"
            />
          </SettingRow>
        </Collapsible>

        <Collapsible title="Indexing" subtitle="Control how and when Echo keeps your index up to date">
          <SettingRow label="Indexing mode">
            <Select
              value={settings.indexingMode}
              options={INDEXING_MODE_OPTIONS}
              onChange={(value) =>
                setSetting('indexingMode', value as IndexingMode)
              }
              className="w-56"
            />
          </SettingRow>

          {settings.indexingMode === 'scheduled' && (
            <SettingRow label="Schedule">
              <Select
                value={settings.scheduleInterval}
                options={SCHEDULE_OPTIONS}
                onChange={(value) =>
                  setSetting('scheduleInterval', value as ScheduleInterval)
                }
                className="w-40"
              />
            </SettingRow>
          )}

          <div className="py-3">
            <p className="text-sm font-medium theme-text">Maximum file size</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {FILE_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFileSizeChange(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition focus-ring ${
                    settings.maxFileSizeBytes === opt.value
                      ? 'border-(--accent) bg-(--accent-soft) text-(--accent)'
                      : 'border-(--border) bg-(--panel) theme-text-secondary hover:theme-text'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Input
              type="text"
              value={customSize}
              onChange={(e) => handleCustomSizeChange(e.target.value)}
              placeholder="Custom: e.g. 250 MB"
              className="mt-2"
            />
            {settings.maxFileSizeBytes > 0 && (
              <p className="mt-1 text-xs theme-text-secondary">
                Files larger than {formatBytes(settings.maxFileSizeBytes)} will
                be skipped
              </p>
            )}
          </div>
        </Collapsible>

        <Collapsible title="Extractors" subtitle="Choose which file types Echo should index">
          <div className="flex flex-wrap gap-2 py-1">
            {EXTRACTOR_OPTIONS.map((extractor) => {
              const enabled = settings.enabledExtractors.includes(extractor.id);
              return (
                <button
                  key={extractor.id}
                  onClick={() => {
                    const next = enabled
                      ? settings.enabledExtractors.filter(
                          (id) => id !== extractor.id
                        )
                      : [...settings.enabledExtractors, extractor.id];
                    setSetting('enabledExtractors', next);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition focus-ring ${
                    enabled
                      ? 'border-(--accent) bg-(--accent-soft) text-(--accent)'
                      : 'border-(--border) bg-(--panel) theme-text-secondary hover:theme-text'
                  }`}
                >
                  {enabled && (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-(--accent) text-(--accent-foreground)">
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 8 8"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 4L3 6L7 2"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                  {extractor.label}
                </button>
              );
            })}
          </div>
        </Collapsible>

        <Collapsible title="Search Intelligence" subtitle="Language-aware indexing and query expansion">
          <SettingRow
            label="Detect language"
            description="Identify English, Hindi, and Marathi documents"
          >
            <Toggle
              checked={settings.enableLanguageDetection}
              onChange={(checked) =>
                setSetting('enableLanguageDetection', checked)
              }
              ariaLabel="Detect language"
              size="md"
            />
          </SettingRow>
          <SettingRow
            label="Remove stop words"
            description="Skip common words during indexing"
          >
            <Toggle
              checked={settings.removeStopWords}
              onChange={(checked) => setSetting('removeStopWords', checked)}
              ariaLabel="Remove stop words"
              size="md"
            />
          </SettingRow>
          <SettingRow
            label="Enable stemming"
            description="Match words with the same English root"
          >
            <Toggle
              checked={settings.enableStemming}
              onChange={(checked) => setSetting('enableStemming', checked)}
              ariaLabel="Enable stemming"
              size="md"
            />
          </SettingRow>
          <SettingRow
            label="Index metadata"
            description="Extract author, dates, language, and content hash"
          >
            <Toggle
              checked={settings.indexMetadata}
              onChange={(checked) => setSetting('indexMetadata', checked)}
              ariaLabel="Index metadata"
              size="md"
            />
          </SettingRow>
        </Collapsible>
      </div>

      <Collapsible title="Ignore Rules" subtitle="Patterns matching files and folders to skip during indexing">
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-(--border) bg-(--panel) px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm theme-text">{rule.pattern}</span>
                <Badge variant="default">{rule.type}</Badge>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Toggle
                  checked={rule.enabled}
                  onChange={() => setEnabled(rule.id, !rule.enabled)}
                  ariaLabel={`Toggle ignore rule ${rule.pattern}`}
                  size="md"
                />
                <IconButton
                  onClick={() => deleteRule(rule.id)}
                  tooltip="Remove rule"
                  variant="danger"
                >
                  <Trash2 size={16} strokeWidth={1.6} />
                </IconButton>
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input
              type="text"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newRule.trim()) {
                  addRule(newRule.trim());
                  setNewRule('');
                }
              }}
              placeholder="e.g. node_modules/ or *.tmp"
              className="flex-1"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (newRule.trim()) {
                  addRule(newRule.trim());
                  setNewRule('');
                }
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </Collapsible>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Collapsible
          title="Backups"
          subtitle="Export or restore your index and settings"
          defaultOpen={false}
        >
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={handleExport} disabled={isExporting}>
              <Save size={14} />
              {isExporting ? 'Exporting…' : 'Export backup'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleImport}
              disabled={isImporting}
            >
              <Upload size={14} />
              {isImporting ? 'Importing…' : 'Import backup'}
            </Button>
          </div>
          {lastResult && (
            <p
              className={`mt-3 text-sm ${
                lastResult.success ? 'text-(--success)' : 'text-(--danger)'
              }`}
            >
              {lastResult.message}
            </p>
          )}
        </Collapsible>

        <Collapsible
          title="Logging"
          subtitle="Choose which logs Echo writes to help diagnose issues"
          defaultOpen={false}
        >
          <SettingRow label="Index logs" description="Log indexing operations">
            <Toggle
              checked={settings.enableIndexLogging}
              onChange={(checked) => setSetting('enableIndexLogging', checked)}
              ariaLabel="Index logs"
              size="md"
            />
          </SettingRow>
          <SettingRow
            label="Watcher logs"
            description="Log file system watcher events"
          >
            <Toggle
              checked={settings.enableWatcherLogging}
              onChange={(checked) =>
                setSetting('enableWatcherLogging', checked)
              }
              ariaLabel="Watcher logs"
              size="md"
            />
          </SettingRow>
          <SettingRow label="Error logs" description="Log indexing errors">
            <Toggle
              checked={settings.enableErrorLogging}
              onChange={(checked) => setSetting('enableErrorLogging', checked)}
              ariaLabel="Error logs"
              size="md"
            />
          </SettingRow>
          <SettingRow label="Debug logs" description="Log detailed debug information">
            <Toggle
              checked={settings.enableDebugLogging}
              onChange={(checked) => setSetting('enableDebugLogging', checked)}
              ariaLabel="Debug logs"
              size="md"
            />
          </SettingRow>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.electron.openLogFolder()}
            className="mt-2"
          >
            Open log folder
          </Button>
        </Collapsible>
      </div>

      <Collapsible
        title="Advanced"
        subtitle="Reliability, maintenance, and recovery options"
        defaultOpen={false}
      >
        <SettingRow
          label="Automatic recovery"
          description="Recover automatically after an interrupted indexing session"
        >
          <Toggle
            checked={settings.autoRecovery}
            onChange={(checked) => setSetting('autoRecovery', checked)}
            ariaLabel="Automatic recovery"
            size="md"
          />
        </SettingRow>
        <SettingRow
          label="Transaction logging"
          description="Log transaction begin, commit, and rollback events"
        >
          <Toggle
            checked={settings.transactionLogging}
            onChange={(checked) => setSetting('transactionLogging', checked)}
            ariaLabel="Transaction logging"
            size="md"
          />
        </SettingRow>
        <SettingRow
          label="Automatic maintenance"
          description="Run maintenance tasks automatically after indexing"
        >
          <Toggle
            checked={settings.automaticMaintenance}
            onChange={(checked) => setSetting('automaticMaintenance', checked)}
            ariaLabel="Automatic maintenance"
            size="md"
          />
        </SettingRow>
        <SettingRow
          label="Integrity check on startup"
          description="Verify database integrity when Echo starts"
        >
          <Toggle
            checked={settings.enableIntegrityCheckOnStartup}
            onChange={(checked) =>
              setSetting('enableIntegrityCheckOnStartup', checked)
            }
            ariaLabel="Integrity check on startup"
            size="md"
          />
        </SettingRow>
        <SettingRow label="Migration behavior">
          <Select
            value={settings.migrationBehavior}
            options={MIGRATION_OPTIONS}
            onChange={(value) =>
              setSetting(
                'migrationBehavior',
                value as 'auto' | 'prompt' | 'block'
              )
            }
            className="w-48"
          />
        </SettingRow>
        <SettingRow label="Recovery behavior">
          <Select
            value={settings.recoveryBehavior}
            options={RECOVERY_OPTIONS}
            onChange={(value) =>
              setSetting(
                'recoveryBehavior',
                value as 'auto' | 'notify' | 'manual'
              )
            }
            className="w-48"
          />
        </SettingRow>

        <div className="mt-4 rounded-xl border border-(--border) bg-(--panel) p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium theme-text">Maintenance</p>
              <p className="text-xs theme-text-secondary">
                Run database maintenance operations
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handleVerify}>
              Verify
            </Button>
            <Button variant="primary" size="sm" onClick={handleRepair}>
              Repair
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleMaintenance({ vacuum: true })}
              disabled={isRunningMaintenance}
            >
              Vacuum
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleMaintenance({})}
              disabled={isRunningMaintenance}
            >
              {isRunningMaintenance ? 'Running…' : 'Optimize'}
            </Button>
            <Button variant="danger" size="sm" onClick={handleResetDatabase}>
              Reset database…
            </Button>
          </div>

          {verifyReport && (
            <div className="mt-3 rounded-lg border border-(--border) bg-(--surface) p-3">
              <div className="flex items-center gap-2">
                {verifyReport.healthy ? (
                  <>
                    <Shield size={14} className="text-(--success)" />
                    <span className="text-sm font-medium text-(--success)">
                      Index is healthy
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} className="text-(--warning)" />
                    <span className="text-sm font-medium text-(--warning)">
                      {verifyReport.issues.length} issue(s) found
                    </span>
                  </>
                )}
              </div>
              {!verifyReport.healthy && (
                <ul className="mt-2 space-y-1">
                  {verifyReport.issues.map((issue, i) => (
                    <li key={i} className="text-sm theme-text-secondary">
                      {issue.description}
                      {issue.details && (
                        <span className="theme-text-tertiary">
                          {' '}
                          — {issue.details}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {repairReport && (
            <div className="mt-3 rounded-lg border border-(--border) bg-(--surface) p-3">
              <div className="flex items-center gap-2">
                <Wrench size={14} className="text-(--accent)" />
                <span className="text-sm font-medium theme-text">
                  {repairReport.issues.length > 0
                    ? `Repair attempted on ${repairReport.issues.length} issue(s)`
                    : 'No issues to repair'}
                </span>
              </div>
            </div>
          )}

          {maintenanceResult && (
            <div className="mt-3 rounded-lg border border-(--border) bg-(--surface) p-3">
              <div className="flex items-center gap-2">
                {maintenanceResult.success ? (
                  <Shield size={14} className="text-(--success)" />
                ) : (
                  <AlertTriangle size={14} className="text-(--warning)" />
                )}
                <span className="text-sm font-medium theme-text">
                  {maintenanceResult.success
                    ? 'Maintenance complete'
                    : 'Maintenance completed with warnings'}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {maintenanceResult.operations.map((op) => (
                  <li key={op.name} className="text-sm theme-text-secondary">
                    {op.name}: {op.success ? 'ok' : 'failed'}
                    {op.message && (
                      <span className="theme-text-tertiary">
                        {' '}
                        — {op.message}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Collapsible>
    </PageShell>
  );
}

function IndexHealthHeader() {
  const { stats, loadHealthStats } = useHealthStore();
  const { startIndexing } = useIndexStore();

  useEffect(() => {
    loadHealthStats();
  }, [loadHealthStats]);

  if (!stats) {
    return (
      <Card className="p-4">
        <p className="text-sm theme-text-secondary">Loading index health…</p>
      </Card>
    );
  }

  const isHealthy = stats.status === 'healthy';
  const isWarning = stats.status === 'warning';

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              isHealthy
                ? 'bg-(--success-soft)'
                : isWarning
                ? 'bg-(--warning-soft)'
                : 'bg-(--danger-soft)'
            }`}
          >
            {isHealthy ? (
              <CheckCircle2 size={20} className="text-(--success)" />
            ) : isWarning ? (
              <AlertTriangle size={20} className="text-(--warning)" />
            ) : (
              <XCircle size={20} className="text-(--danger)" />
            )}
          </div>
          <div>
            <h2 className="text-base font-medium theme-text">Index Health</h2>
            <p className="text-xs theme-text-secondary">
              {isHealthy
                ? 'Your index is up to date and operating normally.'
                : isWarning
                ? 'Review the details below for attention items.'
                : 'Errors detected. Check the Broken Files report.'}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => startIndexing()}
          className="shrink-0"
        >
          <RefreshCw size={14} />
          Sync now
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HealthStat label="Files" value={stats.indexedFiles.toLocaleString()} />
        <HealthStat
          label="Failed"
          value={stats.failedFiles.toLocaleString()}
          highlight={stats.failedFiles > 0 ? 'danger' : undefined}
        />
        <HealthStat label="Folders" value={stats.totalFolders.toLocaleString()} />
        <HealthStat label="Terms" value={stats.totalTerms.toLocaleString()} />
      </div>
    </Card>
  );
}

function HealthStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'danger';
}) {
  return (
    <div className="rounded-lg bg-(--panel) px-3 py-2">
      <p
        className={`text-base font-semibold theme-text ${
          highlight === 'danger' ? 'text-(--danger)' : ''
        }`}
      >
        {value}
      </p>
      <p className="text-xs theme-text-secondary">{label}</p>
    </div>
  );
}

function parseFileSize(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const unit = match[2] || 'b';
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024,
  };

  return Math.round(num * multipliers[unit]);
}
