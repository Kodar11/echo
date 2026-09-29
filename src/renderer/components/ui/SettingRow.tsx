import type { ReactNode } from 'react';

interface SettingRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingRow({
  label,
  description,
  children,
  className = '',
}: SettingRowProps) {
  return (
    <div
      className={`
        flex items-center justify-between gap-4 py-3
        border-b border-(--border) last:border-b-0
        ${className}
      `}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium theme-text">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs theme-text-secondary">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
