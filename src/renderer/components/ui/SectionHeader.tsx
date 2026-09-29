import type { ElementType, ReactNode } from 'react';

interface SectionHeaderProps {
  icon?: ElementType;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--panel) theme-text-secondary">
            <Icon size={16} strokeWidth={1.6} />
          </div>
        )}
        <div>
          <h2 className="text-sm font-medium theme-text">{title}</h2>
          {description && (
            <p className="text-xs theme-text-secondary">{description}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
