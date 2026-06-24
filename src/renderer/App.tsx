import { useEffect, useState } from 'react';
import { SearchPage } from './pages/SearchPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { useThemeStore } from './stores/themeStore.js';

type Page = 'search' | 'settings';

function App() {
  const [page, setPage] = useState<Page>('search');
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="min-h-screen theme-bg theme-text transition-colors duration-300">
      <header className="app-header flex items-center justify-between border-b border-(--border) px-4 py-3 theme-header">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <span className="text-sm font-semibold uppercase tracking-[0.24em] theme-text select-none">
            Echo
          </span>
        </div>

        <nav className="app-header-buttons absolute left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-(--button) p-1">
          <NavButton
            active={page === 'search'}
            onClick={() => setPage('search')}
          >
            Search
          </NavButton>
          <NavButton
            active={page === 'settings'}
            onClick={() => setPage('settings')}
          >
            Settings
          </NavButton>
        </nav>

        <div className="app-header-buttons flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-(--button) text-sm theme-text transition hover:bg-(--button-hover)"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <WindowButton id="minimize" action="MINIMIZE" color="bg-amber-400" />
          <WindowButton id="maximize" action="MAXIMIZE" color="bg-emerald-400" />
          <WindowButton id="close" action="CLOSE" color="bg-red-500" />
        </div>
      </header>

      <main className="pb-12 pt-4">
        {page === 'search' ? <SearchPage /> : <SettingsPage />}
      </main>
    </div>
  );
}

function NavButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={props.onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
        props.active
          ? 'bg-(--surface) theme-text shadow-sm'
          : 'theme-muted hover:theme-text'
      }`}
    >
      {props.children}
    </button>
  );
}

function WindowButton(props: {
  id?: string;
  action: FrameWindowAction;
  color: string;
}) {
  return (
    <button
      id={props.id}
      onClick={() => window.electron.sendFrameAction(props.action)}
      className={`h-3 w-3 rounded-full ${props.color} transition hover:opacity-80`}
      aria-label={props.action}
    />
  );
}

export default App;
