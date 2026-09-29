import { Download, FolderOpen, Upload } from 'lucide-react';
import { useState } from 'react';
import { useBackupStore } from '../../stores/backupStore.js';
import { useIndexStore } from '../../stores/indexStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { humanizeError, toast } from '../../stores/toastStore.js';
import { Button } from '../ui/Button.js';
import { ConfirmDialog } from '../ui/Dialog.js';
import { Select } from '../ui/Select.js';
import { Toggle } from '../ui/Toggle.js';
import { useUpdateSetting } from './GeneralSettings.js';
import { Disclosure, SettingsRow, SettingsSection } from './SettingsLayout.js';

export function BackupSettings() {
  const isExporting = useBackupStore((s) => s.isExporting);
  const isImporting = useBackupStore((s) => s.isImporting);
  const exportBackup = useBackupStore((s) => s.exportBackup);
  const importBackup = useBackupStore((s) => s.importBackup);
  const validateBackup = useBackupStore((s) => s.validateBackup);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);

  const reportResult = () => {
    const result = useBackupStore.getState().lastResult;
    if (!result) return;
    toast(
      result.success
        ? { tone: 'success', title: result.message }
        : { tone: 'error', title: 'Backup didn’t complete', description: humanizeError(result.message, 'Please try again.') },
      6000
    );
  };

  const onExport = async () => {
    const folder = await window.electron.selectFolder();
    if (!folder) return;
    await exportBackup(folder);
    reportResult();
  };

  const onChooseRestore = async () => {
    const file = await window.electron.selectFile();
    if (!file) return;
    const check = await validateBackup(file);
    if (!check.valid) {
      toast({ tone: 'error', title: 'That isn’t a usable Echo backup', description: check.error ? humanizeError(check.error, '') : undefined });
      return;
    }
    setPendingRestore(file);
  };

  const onRestore = async () => {
    if (!pendingRestore) return;
    await importBackup(pendingRestore);
    setPendingRestore(null);
    reportResult();
  };

  return (
    <SettingsSection title="Backup" description="A backup contains your index, library folders and settings.">
      <SettingsRow label="Back up Echo" description="Save a backup file to a folder you choose.">
        <Button variant="secondary" icon={<Download size={14} />} onClick={onExport} isLoading={isExporting}>
          Back up…
        </Button>
      </SettingsRow>
      <SettingsRow label="Restore from backup" description="Replace the current index with one from a backup file.">
        <Button variant="secondary" icon={<Upload size={14} />} onClick={onChooseRestore} isLoading={isImporting}>
          Restore…
        </Button>
      </SettingsRow>
      <ConfirmDialog
        open={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        onConfirm={onRestore}
        isBusy={isImporting}
        title="Restore this backup?"
        description="Your current index, library folders and settings will be replaced by the backup. Restart Echo afterwards to load it."
        confirmLabel="Restore"
      />
    </SettingsSection>
  );
}

const RECOVERY_OPTIONS: { value: 'auto' | 'notify' | 'manual'; label: string }[] = [
  { value: 'auto', label: 'Automatically' },
  { value: 'notify', label: 'Ask first' },
  { value: 'manual', label: 'Never' },
];

const MIGRATION_OPTIONS: { value: 'auto' | 'prompt' | 'block'; label: string }[] = [
  { value: 'auto', label: 'Automatically' },
  { value: 'prompt', label: 'Ask first' },
  { value: 'block', label: 'Don’t upgrade' },
];

export function AdvancedSettings() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useUpdateSetting();
  const resetDatabase = useIndexStore((s) => s.resetDatabase);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const onReset = async () => {
    setResetting(true);
    try {
      await resetDatabase();
      window.location.reload();
    } catch (err) {
      setResetting(false);
      setConfirmReset(false);
      toast({ tone: 'error', title: 'Echo couldn’t reset the database', description: humanizeError(err, 'Please restart Echo and try again.') });
    }
  };

  return (
    <>
      <SettingsSection title="Reliability">
        <SettingsRow label="Recover after interruptions" description="Finish or roll back indexing that was interrupted by a crash or shutdown.">
          <Toggle checked={settings.autoRecovery} onChange={(v) => void update('autoRecovery', v)} ariaLabel="Recover after interruptions" />
        </SettingsRow>
        <SettingsRow label="When recovery is needed">
          <Select
            ariaLabel="When recovery is needed"
            value={settings.recoveryBehavior}
            options={RECOVERY_OPTIONS}
            onChange={(v) => void update('recoveryBehavior', v)}
          />
        </SettingsRow>
        <SettingsRow label="Check the index at startup" description="Verify the database each time Echo starts.">
          <Toggle
            checked={settings.enableIntegrityCheckOnStartup}
            onChange={(v) => void update('enableIntegrityCheckOnStartup', v)}
            ariaLabel="Check the index at startup"
          />
        </SettingsRow>
        <SettingsRow label="Optimize after indexing" description="Tidy up the database after each indexing run.">
          <Toggle
            checked={settings.automaticMaintenance}
            onChange={(v) => void update('automaticMaintenance', v)}
            ariaLabel="Optimize after indexing"
          />
        </SettingsRow>
        <SettingsRow label="Upgrade the index format" description="When a new version of Echo changes how the index is stored.">
          <Select
            ariaLabel="Upgrade the index format"
            value={settings.migrationBehavior}
            options={MIGRATION_OPTIONS}
            onChange={(v) => void update('migrationBehavior', v)}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Logs" description="Logs are written to Echo’s data folder on this computer.">
        <Disclosure summary="Logging options">
          <div className="divide-y divide-line">
            <SettingsRow label="Indexing activity">
              <Toggle checked={settings.enableIndexLogging} onChange={(v) => void update('enableIndexLogging', v)} ariaLabel="Log indexing activity" />
            </SettingsRow>
            <SettingsRow label="Folder changes">
              <Toggle checked={settings.enableWatcherLogging} onChange={(v) => void update('enableWatcherLogging', v)} ariaLabel="Log folder changes" />
            </SettingsRow>
            <SettingsRow label="Errors">
              <Toggle checked={settings.enableErrorLogging} onChange={(v) => void update('enableErrorLogging', v)} ariaLabel="Log errors" />
            </SettingsRow>
            <SettingsRow label="Debug detail" description="Verbose; only useful when reporting a problem.">
              <Toggle checked={settings.enableDebugLogging} onChange={(v) => void update('enableDebugLogging', v)} ariaLabel="Log debug detail" />
            </SettingsRow>
            <SettingsRow label="Database transactions" description="Verbose; only useful when reporting a problem.">
              <Toggle checked={settings.transactionLogging} onChange={(v) => void update('transactionLogging', v)} ariaLabel="Log database transactions" />
            </SettingsRow>
          </div>
        </Disclosure>
        <SettingsRow label="Log files">
          <Button variant="secondary" icon={<FolderOpen size={14} />} onClick={() => void window.electron.openLogFolder()}>
            Open folder
          </Button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Reset">
        <SettingsRow
          label="Reset database"
          description="Erase the index, your library folders, exclusions and settings, and start fresh. Your files aren’t touched."
        >
          <Button variant="danger-ghost" onClick={() => setConfirmReset(true)}>
            Reset database…
          </Button>
        </SettingsRow>
      </SettingsSection>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={onReset}
        isBusy={resetting}
        title="Reset Echo’s database?"
        description={
          <>
            This permanently erases the search index, your library folders, exclusion patterns and settings. Your files
            aren’t touched, but you’ll need to add folders again. <span className="font-medium text-fg">This can’t be undone.</span>
          </>
        }
        confirmLabel="Reset database"
      />
    </>
  );
}
