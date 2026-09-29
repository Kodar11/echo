import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface CollapsibleProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function Collapsible({
  title,
  subtitle,
  children,
  defaultOpen = true,
}: CollapsibleProps) {
  return (
    <details
      className="group rounded-xl border border-(--border) bg-(--surface) overflow-hidden"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 transition-colors hover:bg-(--panel)">
        <div>
          <h3 className="text-sm font-medium theme-text">{title}</h3>
          {subtitle && (
            <p className="text-xs theme-text-secondary">{subtitle}</p>
          )}
        </div>
        <ChevronDown
          size={16}
          className="theme-text-tertiary transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-(--border) px-4 py-3">{children}</div>
    </details>
  );
}
