import clsx from 'clsx';
import { EchoWordmark } from '../brand/EchoMark.js';
import { StatusIndicator } from '../status/StatusIndicator.js';
import { IS_MAC, MOD_KEY } from '../ui/Kbd.js';
import { Tooltip } from '../ui/Tooltip.js';
import { useNavStore, type Page } from '../../stores/navStore.js';

const NAV: { page: Page; label: string; shortcut: string }[] = [
  { page: 'search', label: 'Search', shortcut: `${MOD_KEY} 1` },
  { page: 'library', label: 'Library', shortcut: `${MOD_KEY} 2` },
  { page: 'settings', label: 'Settings', shortcut: `${MOD_KEY} ,` },
];

/**
 * The window's title bar: brand, three destinations and the ambient library
 * status. Native caption buttons are drawn by the OS over the reserved area
 * on the right (Windows/Linux) or left (macOS traffic lights).
 */
export function TitleBar() {
  const page = useNavStore((s) => s.page);
  const navigate = useNavStore((s) => s.navigate);

  return (
    <header
      className={clsx(
        'app-drag relative z-30 flex h-11 shrink-0 select-none items-center gap-3 bg-canvas',
        IS_MAC ? 'pl-[84px] pr-3' : 'pl-3.5 pr-[148px]'
      )}
      onDoubleClick={(e) => {
        if (IS_MAC && e.target === e.currentTarget) window.electron.sendFrameAction('MAXIMIZE');
      }}
    >
      <div className="flex items-center gap-4">
        <EchoWordmark className="max-[560px]:[&>span:last-child]:hidden" />
        <nav aria-label="Main" className="app-no-drag flex items-center gap-0.5">
          {NAV.map((item) => {
            const active = item.page === page;
            return (
              <Tooltip key={item.page} label={item.label} shortcut={item.shortcut}>
                <button
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => navigate(item.page)}
                  className={clsx(
                    'relative h-7 rounded-md px-2.5 text-sm transition-colors duration-150',
                    active ? 'bg-hover font-medium text-fg' : 'text-fg-3 hover:text-fg'
                  )}
                >
                  {item.label}
                </button>
              </Tooltip>
            );
          })}
        </nav>
      </div>

      <div className="flex-1" />

      <div className="app-no-drag">
        <StatusIndicator />
      </div>
    </header>
  );
}
