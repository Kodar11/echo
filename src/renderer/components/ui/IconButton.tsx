import clsx from 'clsx';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Tooltip } from './Tooltip.js';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name; also the tooltip text. */
  label: string;
  shortcut?: string;
  size?: 'sm' | 'md';
  tone?: 'default' | 'danger';
  tooltipSide?: 'top' | 'bottom';
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, size = 'md', tone = 'default', tooltipSide, className, type = 'button', children, ...props },
  ref
) {
  return (
    <Tooltip label={label} shortcut={shortcut} side={tooltipSide}>
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={clsx(
          'inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150',
          'disabled:pointer-events-none disabled:opacity-40',
          size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
          tone === 'danger'
            ? 'text-fg-3 hover:bg-danger-soft hover:text-danger'
            : 'text-fg-3 hover:bg-hover hover:text-fg',
          className
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
});
