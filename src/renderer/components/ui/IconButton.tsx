import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  tooltip?: string;
  variant?: 'default' | 'danger';
}

export function IconButton({
  children,
  tooltip,
  variant = 'default',
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      title={tooltip}
      className={`
        inline-flex h-8 w-8 items-center justify-center rounded-lg
        transition-colors focus-ring disabled:opacity-50
        ${
          variant === 'danger'
            ? 'theme-text-tertiary hover:bg-(--danger-soft) hover:text-(--danger)'
            : 'theme-text-tertiary hover:bg-(--panel) hover:theme-text'
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
