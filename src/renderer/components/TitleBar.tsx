import { useEffect, useState } from 'react';
import {
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Square,
  X,
} from 'lucide-react';
import { IconButton } from './ui/IconButton.js';

interface TitleBarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function TitleBar({ sidebarCollapsed, onToggleSidebar }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let mounted = true;

    window.electron.getWindowState().then((state) => {
      if (mounted) setIsMaximized(state.isMaximized);
    });

    const unsubscribe = window.electron.subscribeWindowState((state) => {
      if (mounted) setIsMaximized(state.isMaximized);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleDoubleClick = () => {
    window.electron.sendFrameAction('MAXIMIZE');
  };

  return (
    <header
      className="flex h-11 shrink-0 select-none items-center justify-between border-b border-(--border) bg-(--sidebar)"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={handleDoubleClick}
    >
      {/* Left: app branding + sidebar toggle */}
      <div
        className="flex h-full items-center gap-1 px-3"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <IconButton
          onClick={onToggleSidebar}
          tooltip={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="h-7 w-7"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={16} strokeWidth={1.7} />
          ) : (
            <PanelLeftClose size={16} strokeWidth={1.7} />
          )}
        </IconButton>

        <div className="ml-2 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-(--accent) text-(--accent-foreground)">
            <span className="text-xs font-bold">E</span>
          </div>
          <span className="text-sm font-medium theme-text">Echo</span>
        </div>
      </div>

      {/* Center: empty (reserved) */}
      <div className="flex-1" />

      {/* Right: window controls */}
      <div
        className="flex h-full items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => window.electron.sendFrameAction('MINIMIZE')}
          className="flex h-full w-11 items-center justify-center theme-text-secondary transition hover:bg-(--panel) hover:theme-text"
          aria-label="Minimize"
        >
          <Minus size={14} strokeWidth={1.8} />
        </button>
        <button
          onClick={() => window.electron.sendFrameAction('MAXIMIZE')}
          className="flex h-full w-11 items-center justify-center theme-text-secondary transition hover:bg-(--panel) hover:theme-text"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6V3.5C3 3.22386 3.22386 3 3.5 3H10.5C10.7761 3 11 3.22386 11 3.5V6" />
              <rect x="3" y="6" width="8" height="5" rx="0.5" />
            </svg>
          ) : (
            <Square size={14} strokeWidth={1.8} />
          )}
        </button>
        <button
          onClick={() => window.electron.sendFrameAction('CLOSE')}
          className="flex h-full w-11 items-center justify-center theme-text-secondary transition hover:bg-(--danger) hover:text-white"
          aria-label="Close"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
