import clsx from 'clsx';

export const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);
export const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl';

/** A keyboard key hint ("Ctrl K", "↵"). */
export function Kbd({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-0.5', className)} aria-hidden="true">
      {keys.map((key) => (
        <kbd
          key={key}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line bg-canvas px-1 font-sans text-2xs font-medium text-fg-3"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
