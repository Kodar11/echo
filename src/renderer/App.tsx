import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Sidebar } from './components/Sidebar.js';
import { FoldersPage } from './pages/FoldersPage.js';
import { SearchPage } from './pages/SearchPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { StatisticsPage } from './pages/StatisticsPage.js';
import { DuplicatesPage } from './pages/DuplicatesPage.js';
import { IndexHealthPage } from './pages/IndexHealthPage.js';
import { BrokenFilesPage } from './pages/BrokenFilesPage.js';
import { useIndexStore } from './stores/indexStore.js';
import {
  listenToSystemThemeChanges,
  useThemeStore,
} from './stores/themeStore.js';

type Page = 'search' | 'folders' | 'statistics' | 'duplicates' | 'health' | 'broken' | 'settings';

function App() {
  const [page, setPage] = useState<Page>('search');
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const theme = useThemeStore((state) => state.theme);
  const preference = useThemeStore((state) => state.preference);
  const syncWithSystem = useThemeStore((state) => state.syncWithSystem);
  const setProgress = useIndexStore((state) => state.setProgress);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (preference !== 'system') return;
    return listenToSystemThemeChanges(() => {
      syncWithSystem();
    });
  }, [preference, syncWithSystem]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPage('search');
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('echo:focus-search'));
        }, 0);
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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden theme-bg theme-text">
      {recoveryMessage && (
        <div className="flex items-center justify-between border-b border-(--border) bg-(--surface) px-4 py-2">
          <p className="text-xs theme-text-secondary">{recoveryMessage}</p>
          <button
            onClick={dismissRecovery}
            className="rounded p-1 hover:bg-(--panel)"
            aria-label="Dismiss recovery notice"
          >
            <X size={14} className="theme-text-secondary" />
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentPage={page} onNavigate={setPage} />
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
