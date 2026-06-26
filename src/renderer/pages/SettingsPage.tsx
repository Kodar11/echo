import { useEffect, useState } from 'react';
import {
  Archive,
  Bug,
  Database,
  Eye,
  FileSearch,
  Filter,
  FolderX,
  HardDrive,
  Info,
  Languages,
  Monitor,
  Moon,
  RefreshCw,
  Save,
  Search,
  Sun,
  Upload,
} from 'lucide-react';
import {
  type ThemePreference,
  useThemeStore,
} from '../stores/themeStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';
import { useIgnoreRulesStore } from '../stores/ignoreRulesStore.js';
import { useBackupStore } from '../stores/backupStore.js';
import { formatBytes } from '../lib/format.js';

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

export function SettingsPage() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const { settings, loadSettings, setSetting } = useSettingsStore();
  const { rules, loadRules, addRule, setEnabled, deleteRule } =
    useIgnoreRulesStore();
  const {
    isExporting,
    isImporting,
    lastResult,
    exportBackup,
    importBackup,
    validateBackup,
    clearResult,
  } = useBackupStore();
  const [newRule, setNewRule] = useState('');
  const [customSize, setCustomSize] = useState('');

  useEffect(() => {
    loadSettings();
    loadRules();
  }, [loadSettings, loadRules]);

  const themeOptions: {
    value: ThemePreference;
    label: string;
    icon: typeof Sun;
  }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

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

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <section className="rounded-xl bg-(--surface) p-5">
          <SectionHeader
            icon={Monitor}
            title="Appearance"
            description="Choose your preferred color scheme"
          />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = preference === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setPreference(option.value)}
                  className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'border-(--accent) bg-(--accent-soft) text-(--accent)'
                      : 'border-(--border) bg-(--panel) theme-text-secondary hover:theme-text'
                  }`}
                >
                  <Icon size={18} strokeWidth={1.6} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl bg-(--surface) p-5">
          <SectionHeader
            icon={RefreshCw}
            title="Indexing"
            description="Control how and when Echo keeps your index up to date"
          />
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-medium theme-text">Indexing mode</label>
              <select
                value={settings.indexingMode}
                onChange={(e) =>
                  setSetting('indexingMode', e.target.value as IndexingMode)
                }
                className="mt-1.5 w-full rounded-lg border border-(--border-strong) bg-(--panel) px-3 py-2 text-sm theme-text outline-none focus:border-(--accent)"
              >
                <option value="immediate">Index immediately (watch folders)</option>
                <option value="startup">Index only on startup</option>
                <option value="scheduled">Scheduled indexing</option>
                <option value="manual">Manual only</option>
              </select>
            </div>

            {settings.indexingMode === 'scheduled' && (
              <div>
                <label className="text-xs font-medium theme-text">Schedule</label>
                <select
                  value={settings.scheduleInterval}
                  onChange={(e) =>
                    setSetting(
                      'scheduleInterval',
                      e.target.value as ScheduleInterval
                    )
                  }
                  className="mt-1.5 w-full rounded-lg border border-(--border-strong) bg-(--panel) px-3 py-2 text-sm theme-text outline-none focus:border-(--accent)"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium theme-text">
                Maximum file size
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {FILE_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleFileSizeChange(opt.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      settings.maxFileSizeBytes === opt.value
                        ? 'border-(--accent) bg-(--accent-soft) text-(--accent)'
                        : 'border-(--border) bg-(--panel) theme-text-secondary hover:theme-text'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customSize}
                onChange={(e) => handleCustomSizeChange(e.target.value)}
                placeholder="Custom: e.g. 250 MB"
                className="mt-2 w-full rounded-lg border border-(--border-strong) bg-(--panel) px-3 py-2 text-sm theme-text outline-none focus:border-(--accent)"
              />
              {settings.maxFileSizeBytes > 0 && (
                <p className="mt-1 text-[11px] theme-text-secondary">
                  Files larger than {formatBytes(settings.maxFileSizeBytes)} will
                  be skipped
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-(--surface) p-5">
          <SectionHeader
            icon={FileSearch}
            title="Extractors"
            description="Choose which file types Echo should index"
          />
          <div className="mt-4 flex flex-wrap gap-2">
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
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    enabled
                      ? 'border-(--accent) bg-(--accent-soft) text-(--accent)'
                      : 'border-(--border) bg-(--panel) theme-text-secondary hover:theme-text'
                  }`}
                >
                  {enabled ? '✓ ' : ''}
                  {extractor.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl bg-(--surface) p-5">
          <SectionHeader
            icon={FolderX}
            title="Ignore Rules"
            description="Patterns matching files and folders to skip during indexing"
          />
          <div className="mt-4 space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between rounded-lg border border-(--border) bg-(--panel) px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs theme-text">{rule.pattern}</span>
                  <span className="rounded bg-(--surface) px-1.5 py-0.5 text-[10px] theme-text-secondary">
                    {rule.type}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEnabled(rule.id, !rule.enabled)}
                    className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                      rule.enabled
                        ? 'bg-(--accent-soft) text-(--accent)'
                        : 'bg-(--surface) theme-text-secondary'
                    }`}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="rounded px-2 py-1 text-[11px] font-medium text-red-500 transition hover:bg-(--surface)"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input
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
                className="flex-1 rounded-lg border border-(--border-strong) bg-(--panel) px-3 py-2 text-sm theme-text outline-none focus:border-(--accent)"
              />
              <button
                onClick={() => {
                  if (newRule.trim()) {
                    addRule(newRule.trim());
                    setNewRule('');
                  }
                }}
                className="rounded-lg bg-(--accent) px-3 py-2 text-xs font-medium text-white transition hover:bg-(--accent-hover)"
              >
                Add
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-(--surface) p-5">
          <SectionHeader
            icon={Archive}
            title="Backups"
            description="Export or restore your index and settings"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-white transition hover:bg-(--accent-hover) disabled:opacity-50"
            >
              <Save size={14} />
              {isExporting ? 'Exporting…' : 'Export backup'}
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="flex items-center gap-2 rounded-lg border border-(--border) bg-(--panel) px-4 py-2 text-sm font-medium theme-text transition hover:bg-(--surface) disabled:opacity-50"
            >
              <Upload size={14} />
              {isImporting ? 'Importing…' : 'Import backup'}
            </button>
          </div>
          {lastResult && (
            <p
              className={`mt-3 text-xs ${
                lastResult.success ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {lastResult.message}
            </p>
          )}
        </section>

        <section className="rounded-xl bg-(--surface) p-5">
          <SectionHeader
            icon={Bug}
            title="Logging"
            description="Choose which logs Echo writes to help diagnose issues"
          />
          <div className="mt-4 space-y-3">
            <SettingToggle
              icon={RefreshCw}
              label="Index logs"
              description="Log indexing operations"
              checked={settings.enableIndexLogging}
              onChange={(checked) => setSetting('enableIndexLogging', checked)}
            />
            <SettingToggle
              icon={Eye}
              label="Watcher logs"
              description="Log file system watcher events"
              checked={settings.enableWatcherLogging}
              onChange={(checked) =>
                setSetting('enableWatcherLogging', checked)
              }
            />
            <SettingToggle
              icon={Database}
              label="Error logs"
              description="Log indexing errors"
              checked={settings.enableErrorLogging}
              onChange={(checked) => setSetting('enableErrorLogging', checked)}
            />
            <SettingToggle
              icon={Bug}
              label="Debug logs"
              description="Log detailed debug information"
              checked={settings.enableDebugLogging}
              onChange={(checked) => setSetting('enableDebugLogging', checked)}
            />
          </div>
          <button
            onClick={() => window.electron.openLogFolder()}
            className="mt-4 rounded-lg border border-(--border) bg-(--panel) px-3 py-2 text-xs font-medium theme-text-secondary transition hover:theme-text"
          >
            Open log folder
          </button>
        </section>

        <section className="rounded-xl bg-(--surface) p-5">
          <SectionHeader
            icon={Languages}
            title="Search intelligence"
            description="Language-aware indexing and query expansion"
          />
          <div className="mt-4 space-y-3">
            <SettingToggle
              icon={Languages}
              label="Detect language"
              description="Identify English, Hindi, and Marathi documents"
              checked={settings.enableLanguageDetection}
              onChange={(checked) =>
                setSetting('enableLanguageDetection', checked)
              }
            />
            <SettingToggle
              icon={Filter}
              label="Remove stop words"
              description="Skip common words during indexing"
              checked={settings.removeStopWords}
              onChange={(checked) => setSetting('removeStopWords', checked)}
            />
            <SettingToggle
              icon={Search}
              label="Enable stemming"
              description="Match words with the same English root (run/running)"
              checked={settings.enableStemming}
              onChange={(checked) => setSetting('enableStemming', checked)}
            />
            <SettingToggle
              icon={FileSearch}
              label="Index metadata"
              description="Extract author, dates, language, and content hash"
              checked={settings.indexMetadata}
              onChange={(checked) => setSetting('indexMetadata', checked)}
            />
          </div>
        </section>

        <section className="rounded-xl bg-(--surface) p-5">
          <SectionHeader
            icon={Info}
            title="About Echo"
            description="Version 0.5.0 — Milestone 6"
          />
          <p className="mt-4 text-xs leading-relaxed theme-text-secondary">
            Echo is a local desktop search engine. Your files are indexed and
            stored entirely on this device. No data is sent to external
            services.
          </p>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof RefreshCw;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
        <Icon size={16} strokeWidth={1.6} />
      </div>
      <div>
        <h2 className="text-sm font-medium theme-text">{title}</h2>
        <p className="text-xs theme-text-secondary">{description}</p>
      </div>
    </div>
  );
}

function SettingToggle({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: typeof RefreshCw;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
          <Icon size={16} strokeWidth={1.6} />
        </div>
        <div>
          <h3 className="text-sm font-medium theme-text">{label}</h3>
          <p className="text-xs theme-text-secondary">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition ${
          checked ? 'bg-(--accent)' : 'bg-(--border-strong)'
        }`}
        aria-checked={checked}
        role="switch"
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform dark:bg-black ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </button>
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
