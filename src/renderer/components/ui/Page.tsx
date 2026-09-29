import clsx from 'clsx';
import type { ReactNode } from 'react';

interface PageProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: 'md' | 'lg';
}

/** Layout for secondary destinations (Library): a quiet header and one column. */
export function Page({ title, description, actions, children, width = 'md' }: PageProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={clsx('mx-auto px-6 pb-12 pt-6', width === 'md' ? 'max-w-[760px]' : 'max-w-[960px]')}>
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold tracking-[-0.01em] text-fg">{title}</h1>
            {description && <p className="mt-0.5 text-sm text-fg-2">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

/** A titled group inside a page or settings pane. */
export function Section({
  title,
  description,
  children,
  className,
  id,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={clsx('mt-8 first:mt-0', className)} aria-labelledby={id}>
      {title && (
        <div className="mb-2.5 px-1">
          <h2 id={id} className="text-sm font-semibold text-fg">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-fg-3">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A bordered group of rows. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface', className)}>
      {children}
    </div>
  );
}
