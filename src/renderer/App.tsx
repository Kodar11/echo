import { useEffect, useLayoutEffect, useState } from 'react';
import { Onboarding } from './components/onboarding/Onboarding.js';
import { TitleBar } from './components/shell/TitleBar.js';
import { Toaster } from './components/ui/Toaster.js';
import { plural } from './lib/format.js';
import { LibraryPage } from './pages/LibraryPage.js';
import { SearchPage } from './pages/SearchPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { useFailuresStore } from './stores/failuresStore.js';
import { useFoldersStore } from './stores/foldersStore.js';
import { useIndexStore } from './stores/indexStore.js';
import { focusSearch, useNavStore } from './stores/navStore.js';
import { useSearchStore } from './stores/searchStore.js';
import { useSettingsStore } from './stores/settingsStore.js';
import { listenToSystemThemeChanges, useThemeStore } from './stores/themeStore.js';
import { toast } from './stores/toastStore.js';

/** Applies the resolved theme to the document and the native caption buttons. */
function useThemeSync() {
  const theme = useThemeStore((s) => s.theme);
  const preference = useThemeStore((s) => s.preference);
  const initializeTheme = useThemeStore((s) => s.initializeFromSettings);
  const syncWithSystem = useThemeStore((s) => s.syncWithSystem);

  useEffect(() => {
    void initializeTheme();
  }, [initializeTheme]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    // Switch instantly: suppress component transitions for one frame.
    root.classList.add('theme-switching');
    root.dataset.theme = theme;
    window.electron.setTitleBarTheme?.(theme);
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    return () => cancelAnimationFrame(frame);
  }, [theme]);

  useEffect(() => {
    if (preference !== 'system') return;
    return listenToSystemThemeChanges(() => syncWithSystem());
  }, [preference, syncWithSystem]);
}

/**
 * Keeps renderer state in step with the backend: live progress events,
 * refreshed counts and search results when a run ends, and a small number of
 * meaningful notifications.
 */
function useIndexingLifecycle() {
  useEffect(() => {
    const index = useIndexStore.getState();
    void index.loadStatus();
    void index.loadStatistics();
    void index.loadProgress();
    void useFoldersStore.getState().loadFolders();
    void useFailuresStore.getState().loadFailures();

    const unsubscribe = window.electron.subscribeIndexingProgress((progress) => {
      const previous = useIndexStore.getState().progress;
      useIndexStore.getState().setProgress(progress);

      const started = previous.status !== 'running' && progress.status === 'running';
      const finished = previous.status === 'running' && progress.status === 'idle';
      if (started) void useFoldersStore.getState().loadFolders();
      if (finished) void onRunFinished(progress);
    });

    window.electron.getRecoveryResult().then((result) => {
      if (!result?.recovered) return;
      toast({ tone: 'neutral', title: 'Echo recovered from an interrupted session', description: result.message }, 8000);
      void window.electron.clearRecoveryResult();
    });

    return unsubscribe;
  }, []);
}

async function onRunFinished(progress: IndexingProgress) {
  await Promise.all([
    useFoldersStore.getState().loadFolders(),
    useIndexStore.getState().loadStatus(),
    useIndexStore.getState().loadStatistics(),
  ]);
  useSearchStore.getState().refresh();
  void useFailuresStore.getState().loadFailures();

  // Background runs (startup, watcher, schedule) finish silently when all is well.
  const userInitiated = progress.trigger === 'manual' || progress.trigger === 'folders';
  const { lastRunFailed } = useIndexStore.getState().status;
  const viewDetails = { label: 'View details', onClick: () => useNavStore.getState().openSettings('diagnostics') };

  switch (progress.lastOutcome) {
    case 'completed_with_errors':
      toast(
        {
          tone: 'warning',
          title: lastRunFailed > 0 ? `${plural(lastRunFailed, 'file')} couldn’t be indexed` : 'Some files couldn’t be indexed',
          description: 'Everything else is searchable.',
          action: viewDetails,
        },
        7000
      );
      break;
    case 'failed':
      toast({ tone: 'error', title: 'Indexing didn’t finish', description: 'Try syncing your library again.', action: viewDetails }, 7000);
      break;
    case 'completed':
      if (userInitiated && progress.indexedFiles > 0) {
        toast({ tone: 'success', title: 'Library is up to date', description: `${plural(progress.indexedFiles, 'file')} indexed.` });
      }
      break;
    default:
      break;
  }
}

function useGlobalShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey) return;
      const nav = useNavStore.getState();
      const key = e.key.toLowerCase();
      if (key === 'k' || key === 'f') {
        e.preventDefault();
        focusSearch();
      } else if (key === '1') {
        e.preventDefault();
        focusSearch();
      } else if (key === '2') {
        e.preventDefault();
        nav.navigate('library');
      } else if (key === ',' || key === '3') {
        e.preventDefault();
        nav.openSettings();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}

/**
 * What the window shows: nothing until settings load (so the app never
 * flashes before onboarding), then onboarding on first launch, else the app.
 */
type Surface = 'loading' | 'onboarding' | 'app';

function App() {
  const page = useNavStore((s) => s.page);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const [surface, setSurface] = useState<Surface>('loading');

  useThemeSync();
  useIndexingLifecycle();
  useGlobalShortcuts(surface === 'app');

  useEffect(() => {
    loadSettings().then(
      () => setSurface(useSettingsStore.getState().settings.onboardingCompleted ? 'app' : 'onboarding'),
      // Never block the app on onboarding bookkeeping.
      () => setSurface('app')
    );
  }, [loadSettings]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-canvas text-fg">
      {surface === 'onboarding' ? (
        <Onboarding onDone={() => setSurface('app')} />
      ) : surface === 'app' ? (
        <>
          <TitleBar />
          <main key={page} className="animate-fade-in relative min-h-0 flex-1">
            {page === 'search' && <SearchPage />}
            {page === 'library' && <LibraryPage />}
            {page === 'settings' && <SettingsPage />}
          </main>
        </>
      ) : (
        <div className="app-drag h-11 shrink-0" />
      )}
      <Toaster />
    </div>
  );
}

export default App;
