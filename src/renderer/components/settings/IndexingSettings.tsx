import clsx from 'clsx';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatBytes } from '../../lib/format.js';
import { useIgnoreRulesStore } from '../../stores/ignoreRulesStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { humanizeError, toast } from '../../stores/toastStore.js';
import { Button } from '../ui/Button.js';
import { IconButton } from '../ui/IconButton.js';
import { Select } from '../ui/Select.js';
import { TextInput } from '../ui/TextInput.js';
import { Toggle } from '../ui/Toggle.js';
import { useUpdateSetting } from './GeneralSettings.js';
import { SettingsRow, SettingsSection } from './SettingsLayout.js';

const MODE_OPTIONS: { value: IndexingMode; label: string }[] = [
  { value: 'immediate', label: 'Continuously' },
  { value: 'startup', label: 'When Echo starts' },
  { value: 'scheduled', label: 'On a schedule' },
  { value: 'manual', label: 'Only when I sync' },
];

const MODE_HINTS: Record<IndexingMode, string> = {
  immediate: 'Echo watches your library and indexes changes as they happen.',
  startup: 'Echo catches up with changes each time it starts.',
  scheduled: 'Echo checks your library for changes at a regular interval.',
  manual: 'The index only changes when you choose Sync now.',
};

const SCHEDULE_OPTIONS: { value: ScheduleInterval; label: string }[] = [
  { value: 'hourly', label: 'Every hour' },
  { value: 'daily', label: 'Once a day' },
];

const SIZE_PRESETS = [0, 10, 50, 100, 500, 1024].map((mb) => mb * 1024 * 1024);

const FILE_TYPES: { id: ExtractorId; label: string; hint: string }[] = [
  { id: 'pdf', label: 'PDF', hint: '.pdf' },
  { id: 'docx', label: 'Word', hint: '.docx' },
  { id: 'html', label: 'Web pages', hint: '.html' },
  { id: 'markdown', label: 'Markdown', hint: '.md' },
  { id: 'text', label: 'Plain text', hint: '.txt' },
];

export function IndexingSettings() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useUpdateSetting();

  const sizeOptions = SIZE_PRESETS.map((bytes) => ({
    value: String(bytes),
    label: bytes === 0 ? 'No limit' : formatBytes(bytes),
  }));
  if (!SIZE_PRESETS.includes(settings.maxFileSizeBytes)) {
    sizeOptions.push({ value: String(settings.maxFileSizeBytes), label: formatBytes(settings.maxFileSizeBytes) });
  }

  const toggleType = (id: ExtractorId) => {
    const enabled = settings.enabledExtractors.includes(id);
    if (enabled && settings.enabledExtractors.length === 1) {
      toast({ tone: 'warning', title: 'Keep at least one file type', description: 'Echo needs something to index.' });
      return;
    }
    const next = enabled ? settings.enabledExtractors.filter((x) => x !== id) : [...settings.enabledExtractors, id];
    void update('enabledExtractors', next);
  };

  return (
    <>
      <SettingsSection title="Keeping up to date">
        <SettingsRow label="Update the index" description={MODE_HINTS[settings.indexingMode]}>
          <Select
            ariaLabel="Update the index"
            value={settings.indexingMode}
            options={MODE_OPTIONS}
            onChange={(v) => void update('indexingMode', v)}
          />
        </SettingsRow>
        {settings.indexingMode === 'scheduled' && (
          <SettingsRow label="Schedule">
            <Select
              ariaLabel="Schedule"
              value={settings.scheduleInterval}
              options={SCHEDULE_OPTIONS}
              onChange={(v) => void update('scheduleInterval', v)}
            />
          </SettingsRow>
        )}
      </SettingsSection>

      <SettingsSection title="What gets indexed" description="Changing these re-indexes your library in the background.">
        <SettingsRow label="File types" description="Echo reads the text inside these kinds of files." align="start">
          <div role="group" aria-label="File types" className="flex max-w-[340px] flex-wrap justify-end gap-1.5">
            {FILE_TYPES.map((type) => {
              const on = settings.enabledExtractors.includes(type.id);
              return (
                <button
                  key={type.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggleType(type.id)}
                  className={clsx(
                    'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                    on
                      ? 'border-transparent bg-accent-soft text-accent-text'
                      : 'border-line text-fg-3 hover:border-line-strong hover:text-fg'
                  )}
                >
                  {on && <Check size={12} strokeWidth={2.5} />}
                  {type.label}
                </button>
              );
            })}
          </div>
        </SettingsRow>
        <SettingsRow
          label="Largest file to index"
          description="Very large files slow indexing down and rarely hold what you’re looking for."
        >
          <Select
            ariaLabel="Largest file to index"
            value={String(settings.maxFileSizeBytes)}
            options={sizeOptions}
            onChange={(v) => void update('maxFileSizeBytes', Number(v))}
          />
        </SettingsRow>
        <SettingsRow label="File details" description="Store author, dates and language so you can filter by them.">
          <Toggle checked={settings.indexMetadata} onChange={(v) => void update('indexMetadata', v)} ariaLabel="Store file details" />
        </SettingsRow>
      </SettingsSection>

      <IgnoreRules />
    </>
  );
}

function IgnoreRules() {
  const rules = useIgnoreRulesStore((s) => s.rules);
  const loadRules = useIgnoreRulesStore((s) => s.loadRules);
  const addRule = useIgnoreRulesStore((s) => s.addRule);
  const setEnabled = useIgnoreRulesStore((s) => s.setEnabled);
  const deleteRule = useIgnoreRulesStore((s) => s.deleteRule);
  const [pattern, setPattern] = useState('');

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const submit = async () => {
    const value = pattern.trim();
    if (!value) return;
    try {
      await addRule(value);
      setPattern('');
    } catch (err) {
      toast({ tone: 'error', title: 'Couldn’t add that pattern', description: humanizeError(err, 'Check the pattern and try again.') });
    }
  };

  return (
    <SettingsSection
      title="Excluded files and folders"
      description="Anything matching these patterns is skipped. Use folder names like node_modules/ or wildcards like *.tmp."
    >
      {rules.map((rule) => (
        <div key={rule.id} className="flex items-center gap-3 px-4 py-2">
          <code className={clsx('min-w-0 flex-1 truncate font-mono text-[12.5px]', rule.enabled ? 'text-fg' : 'text-fg-3 line-through')}>
            {rule.pattern}
          </code>
          <span className="text-2xs text-fg-3">{rule.type === 'folder' ? 'Folder' : 'Pattern'}</span>
          <Toggle checked={rule.enabled} onChange={(v) => void setEnabled(rule.id, v)} ariaLabel={`Apply ${rule.pattern}`} />
          <IconButton size="sm" tone="danger" label="Remove pattern" onClick={() => void deleteRule(rule.id)}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      ))}
      <form
        className="flex items-center gap-2 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextInput
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="e.g. node_modules/ or *.tmp"
          aria-label="New exclusion pattern"
          className="font-mono text-[12.5px]"
        />
        <Button type="submit" variant="secondary" icon={<Plus size={14} />} disabled={!pattern.trim()}>
          Add
        </Button>
      </form>
    </SettingsSection>
  );
}
