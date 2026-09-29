import clsx from 'clsx';

/**
 * The Echo mark: a signal point with two receding rings — a quiet reference
 * to an echo, used for the app icon slot, wordmark and loading moments.
 */
export function EchoMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={clsx('shrink-0', className)}>
      <circle cx="12" cy="12" r="10.25" stroke="var(--accent)" strokeOpacity="0.28" strokeWidth="1.5" />
      <path d="M12 5.75a6.25 6.25 0 1 1-6.25 6.25" stroke="var(--accent)" strokeOpacity="0.62" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.75" fill="var(--accent)" />
    </svg>
  );
}

export function EchoWordmark({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <EchoMark size={18} />
      <span className="font-display text-sm font-semibold tracking-[-0.01em] text-fg">Echo</span>
    </span>
  );
}
