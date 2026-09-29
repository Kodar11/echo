import clsx from 'clsx';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name (required when there is no visible label). */
  ariaLabel?: string;
  id?: string;
}

export function Toggle({ checked, onChange, disabled = false, ariaLabel, id }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-accent bg-accent' : 'border-line-strong bg-press hover:border-fg-3'
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'absolute h-3.5 w-3.5 rounded-full shadow-sm transition-transform duration-150 ease-out',
          checked ? 'translate-x-[18px] bg-accent-fg' : 'translate-x-[2px] bg-fg-2'
        )}
      />
    </button>
  );
}
