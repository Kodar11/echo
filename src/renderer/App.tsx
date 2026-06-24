import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { FoldersPage } from './pages/FoldersPage.js';
import { SearchPage } from './pages/SearchPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { StatisticsPage } from './pages/StatisticsPage.js';
import { useIndexStore } from './stores/indexStore.js';
import {
  listenToSystemThemeChanges,
  useThemeStore,
} from './stores/themeStore.js';

type Page = 'search' | 'folders' | 'statistics' | 'settings';

function App() {
  const [page, setPage] = useState<Page>('search');
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

  return (
    <div className="flex h-screen w-screen overflow-hidden theme-bg theme-text">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <main className="flex-1 overflow-hidden">
        {page === 'search' && <SearchPage />}
        {page === 'folders' && <FoldersPage />}
        {page === 'statistics' && <StatisticsPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
