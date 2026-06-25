import { useEffect } from 'react';
import {
  Eye,
  Info,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
} from 'lucide-react';
import {
  type ThemePreference,
  useThemeStore,
} from '../stores/themeStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';

export function SettingsPage() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const { settings, loadSettings, setSetting } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const themeOptions: {
    value: ThemePreference;
    label: string;
    icon: typeof Sun;
  }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <section className="rounded-xl bg-(--surface) p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
              <Monitor size={16} strokeWidth={1.6} />
            </div>
            <div>
              <h2 className="text-sm font-medium theme-text">Appearance</h2>
              <p className="text-xs theme-text-secondary">
                Choose your preferred color scheme
              </p>
            </div>
          </div>

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
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
              <RefreshCw size={16} strokeWidth={1.6} />
            </div>
            <div>
              <h2 className="text-sm font-medium theme-text">Index maintenance</h2>
              <p className="text-xs theme-text-secondary">
                Keep your index in sync automatically
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <SettingToggle
              icon={RefreshCw}
              label="Sync on startup"
              description="Check indexed folders for changes when Echo starts"
              checked={settings.autoSyncOnStartup}
              onChange={(checked) => setSetting('autoSyncOnStartup', checked)}
            />
            <SettingToggle
              icon={Eye}
              label="Watch folders"
              description="Update the index when files change on disk"
              checked={settings.enableWatchers}
              onChange={(checked) => setSetting('enableWatchers', checked)}
            />
          </div>
        </section>

        <section className="rounded-xl bg-(--surface) p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
              <Info size={16} strokeWidth={1.6} />
            </div>
            <div>
              <h2 className="text-sm font-medium theme-text">About Echo</h2>
              <p className="text-xs theme-text-secondary">
                Version 0.3.0 — Milestone 3
              </p>
            </div>
          </div>
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
