import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'panel';
}

export function Card({
  children,
  className = '',
  variant = 'default',
}: CardProps) {
  return (
    <div
      className={`
        rounded-xl border border-(--border)
        ${variant === 'default' ? 'bg-(--surface)' : 'bg-(--panel)'}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
