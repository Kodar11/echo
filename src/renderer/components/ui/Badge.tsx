import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-(--panel) theme-text-secondary',
  accent: 'bg-(--accent-soft) text-(--accent)',
  success: 'bg-(--success-soft) text-(--success)',
  warning: 'bg-(--warning-soft) text-(--warning)',
  danger: 'bg-(--danger-soft) text-(--danger)',
};

export function Badge({
  children,
  variant = 'default',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-md px-1.5 py-0.5 text-2xs font-medium
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
