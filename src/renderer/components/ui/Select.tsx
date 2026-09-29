import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { Menu } from './Menu.js';

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  /** 'field' = bordered control; 'inline' = quiet text trigger. */
  appearance?: 'field' | 'inline';
  className?: string;
  width?: number;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
  appearance = 'field',
  className,
  width,
}: SelectProps<T>) {
  const selected = options.find((o) => o.value === value);
  return (
    <Menu
      label={ariaLabel}
      width={width ?? (appearance === 'field' ? 220 : 180)}
      entries={options.map((option) => ({
        id: option.value,
        label: option.label,
        checked: option.value === value,
        onSelect: () => onChange(option.value),
      }))}
      trigger={({ ref, toggle, open, ...aria }) => (
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          onClick={toggle}
          aria-label={`${ariaLabel}: ${selected?.label ?? ''}`}
          {...aria}
          className={clsx(
            'inline-flex items-center justify-between gap-2 text-sm transition-colors disabled:opacity-50',
            appearance === 'field'
              ? 'h-8 min-w-[9rem] rounded-md border border-line bg-surface px-2.5 text-fg hover:border-line-strong'
              : 'h-7 rounded-sm px-2 text-fg-2 hover:bg-hover hover:text-fg',
            open && appearance === 'field' && 'border-line-strong',
            className
          )}
        >
          <span className="truncate">{selected?.label}</span>
          <ChevronDown size={14} className={clsx('shrink-0 text-fg-3 transition-transform', open && 'rotate-180')} />
        </button>
      )}
    />
  );
}
