import { Info, Monitor, Moon, Sun } from 'lucide-react';
import {
  type ThemePreference,
  useThemeStore,
} from '../stores/themeStore.js';

export function SettingsPage() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  const options: { value: ThemePreference; label: string; icon: typeof Sun }[] =
    [
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
            {options.map((option) => {
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
              <Info size={16} strokeWidth={1.6} />
            </div>
            <div>
              <h2 className="text-sm font-medium theme-text">About Echo</h2>
              <p className="text-xs theme-text-secondary">
                Version 0.2.0 — Milestone 2
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
