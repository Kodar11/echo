import { Lock, Monitor, Moon, Sun } from 'lucide-react';
import { useCallback } from 'react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { type ThemePreference, useThemeStore } from '../../stores/themeStore.js';
import { humanizeError, toast } from '../../stores/toastStore.js';
import { SegmentedControl } from '../ui/SegmentedControl.js';
import { Toggle } from '../ui/Toggle.js';
import { SettingsRow, SettingsSection } from './SettingsLayout.js';

/** Persists one setting; failures surface as a toast instead of silently reverting. */
export function useUpdateSetting() {
  const setSetting = useSettingsStore((s) => s.setSetting);
  return useCallback(
    async (key: keyof AppSettings, value: boolean | string | number | ExtractorId[]) => {
      try {
        await setSetting(key, value);
      } catch (err) {
        toast({ tone: 'error', title: 'Couldn’t save that setting', description: humanizeError(err, 'Please try again.') });
      }
    },
    [setSetting]
  );
}

export function AppearanceSettings() {
  const preference = useThemeStore((s) => s.preference);
  const persistPreference = useThemeStore((s) => s.persistPreference);

  return (
    <SettingsSection title="Theme">
      <SettingsRow label="Appearance" description="Use a light or dark theme, or follow Windows.">
        <SegmentedControl<ThemePreference>
          ariaLabel="Theme"
          value={preference}
          onChange={(value) => void persistPreference(value)}
          options={[
            { value: 'system', label: 'System', icon: <Monitor size={13} /> },
            { value: 'light', label: 'Light', icon: <Sun size={13} /> },
            { value: 'dark', label: 'Dark', icon: <Moon size={13} /> },
          ]}
        />
      </SettingsRow>
    </SettingsSection>
  );
}

export function SearchSettings() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useUpdateSetting();

  return (
    <SettingsSection
      title="Matching"
      description="Changing these re-indexes your library in the background."
    >
      <SettingsRow label="Match word variations" description="Find “running” and “runs” when you search for “run”. English only.">
        <Toggle checked={settings.enableStemming} onChange={(v) => void update('enableStemming', v)} ariaLabel="Match word variations" />
      </SettingsRow>
      <SettingsRow label="Ignore common words" description="Skip words like “the” and “and” so results focus on what matters.">
        <Toggle checked={settings.removeStopWords} onChange={(v) => void update('removeStopWords', v)} ariaLabel="Ignore common words" />
      </SettingsRow>
      <SettingsRow
        label="Detect document language"
        description="Recognises English, Hindi and Marathi documents and enables the language filter."
      >
        <Toggle
          checked={settings.enableLanguageDetection}
          onChange={(v) => void update('enableLanguageDetection', v)}
          ariaLabel="Detect document language"
        />
      </SettingsRow>
    </SettingsSection>
  );
}

export function PrivacySettings() {
  return (
    <SettingsSection title="Your data">
      <div className="flex gap-3 px-4 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-text">
          <Lock size={15} />
        </span>
        <div className="text-sm text-fg-2">
          <p className="font-medium text-fg">Your index stays on this computer.</p>
          <p className="mt-1">
            Echo reads the folders in your library, builds its search index on this computer and searches it locally.
            Removing a folder removes its files from the index; your files themselves are never changed.
          </p>
          <p className="mt-2 text-xs text-fg-3">
            To erase the index completely, use Reset database under Advanced.
          </p>
        </div>
      </div>
    </SettingsSection>
  );
}
