import clsx from 'clsx';
import {
  Activity,
  Archive,
  Database,
  Palette,
  Search,
  Shield,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { AdvancedSettings, BackupSettings } from '../components/settings/AdvancedSettings.js';
import { DiagnosticsView } from '../components/settings/DiagnosticsView.js';
import { AppearanceSettings, PrivacySettings, SearchSettings } from '../components/settings/GeneralSettings.js';
import { IndexingSettings } from '../components/settings/IndexingSettings.js';
import { useNavStore, type SettingsSectionId } from '../stores/navStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';

interface SectionDef {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  render: () => JSX.Element;
}

const SECTIONS: SectionDef[] = [
  { id: 'appearance', label: 'Appearance', description: 'How Echo looks.', icon: Palette, render: () => <AppearanceSettings /> },
  { id: 'search', label: 'Search', description: 'How Echo matches what you type.', icon: Search, render: () => <SearchSettings /> },
  {
    id: 'indexing',
    label: 'Indexing',
    description: 'What Echo reads and when it updates the index.',
    icon: Database,
    render: () => <IndexingSettings />,
  },
  { id: 'privacy', label: 'Privacy', description: 'Where your index lives.', icon: Shield, render: () => <PrivacySettings /> },
  {
    id: 'backup',
    label: 'Backup & restore',
    description: 'Keep a copy of your index and settings.',
    icon: Archive,
    render: () => <BackupSettings />,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Recovery, logs and resetting Echo.',
    icon: SlidersHorizontal,
    render: () => <AdvancedSettings />,
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    description: 'The state of your index, and files that need attention.',
    icon: Activity,
    render: () => <DiagnosticsView />,
  },
];

export function SettingsPage() {
  const sectionId = useNavStore((s) => s.settingsSection);
  const openSettings = useNavStore((s) => s.openSettings);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const contentRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [sectionId]);

  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];

  const onNavKey = (e: KeyboardEvent) => {
    const keys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    const index = SECTIONS.findIndex((s) => s.id === section.id);
    const next = SECTIONS[(index + (forward ? 1 : SECTIONS.length - 1)) % SECTIONS.length];
    openSettings(next.id);
    navRef.current?.querySelector<HTMLElement>(`[data-section="${next.id}"]`)?.focus();
  };

  return (
    <div className="flex h-full min-h-0 max-[760px]:flex-col">
      <nav
        ref={navRef}
        aria-label="Settings"
        role="tablist"
        aria-orientation="vertical"
        onKeyDown={onNavKey}
        className={clsx(
          'flex shrink-0 flex-col gap-0.5 px-3 pt-6',
          'w-[216px] max-[760px]:w-full max-[760px]:flex-row max-[760px]:overflow-x-auto max-[760px]:border-b max-[760px]:border-line max-[760px]:pb-2 max-[760px]:pt-2'
        )}
      >
        <h1 className="mb-3 px-2.5 font-display text-xl font-semibold tracking-[-0.01em] text-fg max-[760px]:sr-only">Settings</h1>
        {SECTIONS.map((item, i) => {
          const active = item.id === section.id;
          const Icon = item.icon;
          return (
            <div key={item.id} className="contents">
              {i === SECTIONS.length - 2 && <div className="mx-2.5 my-2 h-px bg-line max-[760px]:hidden" aria-hidden="true" />}
              <button
                type="button"
                role="tab"
                data-section={item.id}
                aria-selected={active}
                aria-controls="settings-panel"
                tabIndex={active ? 0 : -1}
                onClick={() => openSettings(item.id)}
                className={clsx(
                  'flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors duration-150',
                  active ? 'bg-hover font-medium text-fg' : 'text-fg-2 hover:bg-hover/60 hover:text-fg'
                )}
              >
                <Icon size={15} className={active ? 'text-accent-text' : 'text-fg-3'} />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      <div ref={contentRef} className="min-w-0 flex-1 overflow-y-auto">
        <div
          id="settings-panel"
          role="tabpanel"
          aria-label={section.label}
          key={section.id}
          className="animate-fade-in mx-auto max-w-[720px] px-8 pb-12 pt-6 max-[760px]:px-5"
        >
          <header className="mb-6">
            <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-fg">{section.label}</h2>
            <p className="mt-0.5 text-sm text-fg-2">{section.description}</p>
          </header>
          {section.render()}
        </div>
      </div>
    </div>
  );
}
