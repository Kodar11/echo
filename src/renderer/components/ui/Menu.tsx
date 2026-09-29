import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Popover } from './Popover.js';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
  checked?: boolean;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onSelect: () => void;
}

export type MenuEntry = MenuItem | 'separator' | { heading: string };

/** Arrow-key navigation shared by menus and option lists. */
export function handleMenuKeys(e: KeyboardEvent<HTMLElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const items = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled]), [role="option"]')
  );
  if (items.length === 0) return;
  e.preventDefault();
  const index = items.indexOf(document.activeElement as HTMLElement);
  let next = 0;
  if (e.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length;
  if (e.key === 'ArrowUp') next = index <= 0 ? items.length - 1 : index - 1;
  if (e.key === 'End') next = items.length - 1;
  items[next]?.focus();
}

export function MenuList({ entries, onClose }: { entries: MenuEntry[]; onClose: () => void }) {
  return (
    <div className="flex flex-col p-1" onKeyDown={handleMenuKeys}>
      {entries.map((entry, i) => {
        if (entry === 'separator') return <div key={`sep-${i}`} className="my-1 h-px bg-line" />;
        if ('heading' in entry) {
          return (
            <div key={`h-${i}`} className="px-2 pb-1 pt-2 text-2xs font-medium uppercase tracking-wide text-fg-3">
              {entry.heading}
            </div>
          );
        }
        const radio = entry.checked !== undefined;
        return (
          <button
            key={entry.id}
            type="button"
            role={radio ? 'menuitemradio' : 'menuitem'}
            aria-checked={radio ? entry.checked : undefined}
            disabled={entry.disabled}
            onClick={() => {
              onClose();
              entry.onSelect();
            }}
            className={clsx(
              'flex h-8 w-full items-center gap-2.5 rounded-sm px-2 text-left text-sm outline-none',
              'focus-visible:outline-none focus-visible:bg-hover hover:bg-hover disabled:opacity-40',
              entry.tone === 'danger' ? 'text-danger' : 'text-fg'
            )}
          >
            {entry.icon && (
              <span className={clsx('flex w-4 justify-center', entry.tone === 'danger' ? '' : 'text-fg-3')}>
                {entry.icon}
              </span>
            )}
            <span className="flex-1 truncate">{entry.label}</span>
            {entry.hint && <span className="text-xs text-fg-3">{entry.hint}</span>}
            {entry.checked && <Check size={14} className="text-accent-text" />}
          </button>
        );
      })}
    </div>
  );
}

interface MenuProps {
  trigger: (props: {
    ref: React.RefObject<HTMLButtonElement>;
    open: boolean;
    toggle: () => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
  }) => ReactNode;
  entries: MenuEntry[];
  align?: 'start' | 'end';
  width?: number;
  label: string;
}

/** A trigger plus a contextual menu. */
export function Menu({ trigger, entries, align = 'end', width = 220, label }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      {trigger({
        ref,
        open,
        toggle: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      })}
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} align={align} width={width} role="menu" label={label}>
        <MenuList entries={entries} onClose={() => setOpen(false)} />
      </Popover>
    </>
  );
}
