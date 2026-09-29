import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Panel } from '../ui/Page.js';

/** A titled group of settings rows. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mt-8 first:mt-0">
      <div className="mb-2.5 px-1">
        <h3 id={id} className="text-sm font-semibold text-fg">
          {title}
        </h3>
        {description && <p className="mt-0.5 text-xs text-fg-3">{description}</p>}
      </div>
      <Panel>{children}</Panel>
    </section>
  );
}

/** Label + description on the left, control on the right; stacks when narrow. */
export function SettingsRow({
  label,
  description,
  children,
  htmlFor,
  align = 'center',
}: {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  htmlFor?: string;
  align?: 'center' | 'start';
}) {
  return (
    <div
      className={clsx(
        'flex flex-wrap justify-between gap-x-6 gap-y-2 px-4 py-3',
        align === 'center' ? 'items-center' : 'items-start'
      )}
    >
      <div className="min-w-[220px] flex-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
            {label}
          </label>
        ) : (
          <p className="text-sm font-medium text-fg">{label}</p>
        )}
        {description && <p className="mt-0.5 text-xs text-fg-3">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

/** Progressive disclosure for secondary detail inside a panel. */
export function Disclosure({
  summary,
  meta,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-hover"
      >
        <ChevronRight size={14} className={clsx('shrink-0 text-fg-3 transition-transform duration-150', open && 'rotate-90')} />
        <span className="flex-1 text-sm font-medium text-fg">{summary}</span>
        {meta && <span className="text-xs text-fg-3">{meta}</span>}
      </button>
      {open && (
        <div id={id} className="animate-fade-in border-t border-line">
          {children}
        </div>
      )}
    </div>
  );
}

/** A compact key/value grid for diagnostics. */
export function StatGrid({ items }: { items: { label: string; value: ReactNode; tone?: 'warning' | 'danger' }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-4 py-3">
          <dt className="text-xs text-fg-3">{item.label}</dt>
          <dd
            className={clsx(
              'mt-0.5 text-lg font-semibold tabular-nums',
              item.tone === 'warning' ? 'text-warning' : item.tone === 'danger' ? 'text-danger' : 'text-fg'
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function KeyValueList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 px-4 py-3 text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-fg-2">{item.label}</dt>
          <dd className="text-right tabular-nums text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
