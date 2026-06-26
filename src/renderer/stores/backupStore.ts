import { create } from 'zustand';

interface BackupState {
  isExporting: boolean;
  isImporting: boolean;
  lastResult: { success: boolean; message: string } | null;
  exportBackup: (destinationPath: string) => Promise<void>;
  importBackup: (sourcePath: string) => Promise<void>;
  validateBackup: (sourcePath: string) => Promise<{ valid: boolean; error?: string }>;
  clearResult: () => void;
}

export const useBackupStore = create<BackupState>((set) => ({
  isExporting: false,
  isImporting: false,
  lastResult: null,
  exportBackup: async (destinationPath) => {
    set({ isExporting: true, lastResult: null });
    try {
      await window.electron.exportBackup({ destinationPath });
      set({
        lastResult: { success: true, message: 'Backup exported successfully' },
      });
    } catch (err) {
      set({
        lastResult: {
          success: false,
          message: err instanceof Error ? err.message : String(err),
        },
      });
    } finally {
      set({ isExporting: false });
    }
  },
  importBackup: async (sourcePath) => {
    set({ isImporting: true, lastResult: null });
    try {
      await window.electron.importBackup({ sourcePath });
      set({
        lastResult: {
          success: true,
          message: 'Backup imported. Restart Echo to load the restored index.',
        },
      });
    } catch (err) {
      set({
        lastResult: {
          success: false,
          message: err instanceof Error ? err.message : String(err),
        },
      });
    } finally {
      set({ isImporting: false });
    }
  },
  validateBackup: async (sourcePath) => {
    return window.electron.validateBackup({ sourcePath });
  },
  clearResult: () => set({ lastResult: null }),
}));
