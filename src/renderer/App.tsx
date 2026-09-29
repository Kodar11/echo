import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Sidebar } from './components/Sidebar.js';
import { TitleBar } from './components/TitleBar.js';
import { FoldersPage } from './pages/FoldersPage.js';
import { SearchPage } from './pages/SearchPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { StatisticsPage } from './pages/StatisticsPage.js';
import { DuplicatesPage } from './pages/DuplicatesPage.js';
import { IndexHealthPage } from './pages/IndexHealthPage.js';
import { BrokenFilesPage } from './pages/BrokenFilesPage.js';
import { useIndexStore } from './stores/indexStore.js';
import { useSettingsStore } from './stores/settingsStore.js';
import {
  listenToSystemThemeChanges,
  useThemeStore,
} from './stores/themeStore.js';
import { IconButton } from './components/ui/IconButton.js';

type Page = 'search' | 'folders' | 'statistics' | 'duplicates' | 'health' | 'broken' | 'settings';

function App() {
  const [page, setPage] = useState<Page>('search');
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const theme = useThemeStore((state) => state.theme);
  const preference = useThemeStore((state) => state.preference);
  const initializeTheme = useThemeStore((state) => state.initializeFromSettings);
  const syncWithSystem = useThemeStore((state) => state.syncWithSystem);

  const settings = useSettingsStore((state) => state.settings);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const setSetting = useSettingsStore((state) => state.setSetting);

  const setProgress = useIndexStore((state) => state.setProgress);

  // Initialize settings and theme on mount.
  useEffect(() => {
    loadSettings();
    initializeTheme();
  }, [loadSettings, initializeTheme]);

  // Apply theme to <html> whenever it changes.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Listen to system theme changes when preference is "system".
  useEffect(() => {
    if (preference !== 'system') return;
    return listenToSystemThemeChanges(() => {
      syncWithSystem();
    });
  }, [preference, syncWithSystem]);

  // Global keyboard shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey;

      if (isModifier && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPage('search');
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('echo:focus-search'));
        }, 0);
      } else if (isModifier && e.key === '\\') {
        e.preventDefault();
        const current = useSettingsStore.getState().settings.sidebarCollapsed;
        useSettingsStore.getState().setSetting('sidebarCollapsed', !current);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const unsubscribe = window.electron.subscribeIndexingProgress((progress) => {
      setProgress(progress);
    });
    return () => unsubscribe();
  }, [setProgress]);

  useEffect(() => {
    window.electron.getRecoveryResult().then((result) => {
      if (result?.recovered) {
        setRecoveryMessage(result.message);
      }
    });
  }, []);

  const dismissRecovery = () => {
    setRecoveryMessage(null);
    window.electron.clearRecoveryResult();
  };

  const toggleSidebar = () => {
    setSetting('sidebarCollapsed', !settings.sidebarCollapsed);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden theme-bg theme-text">
      <TitleBar
        sidebarCollapsed={settings.sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
      />

      {recoveryMessage && (
        <div className="flex items-center justify-between gap-4 border-b border-(--border) bg-(--surface) px-4 py-2.5">
          <p className="text-xs theme-text-secondary">{recoveryMessage}</p>
          <IconButton
            onClick={dismissRecovery}
            aria-label="Dismiss recovery notice"
            className="shrink-0"
          >
            <X size={14} />
          </IconButton>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentPage={page}
          onNavigate={setPage}
          collapsed={settings.sidebarCollapsed}
        />
        <main className="flex-1 overflow-hidden">
          {page === 'search' && <SearchPage />}
          {page === 'folders' && <FoldersPage />}
          {page === 'statistics' && <StatisticsPage />}
          {page === 'duplicates' && <DuplicatesPage />}
          {page === 'health' && <IndexHealthPage />}
          {page === 'broken' && <BrokenFilesPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

export default App;
