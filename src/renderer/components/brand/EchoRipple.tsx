import clsx from 'clsx';

/**
 * Decorative concentric rings behind the empty search state. Static rings
 * give depth; three slow ripples expand and fade from the centre. Purely
 * ambient: hidden from assistive tech, frozen under reduced motion.
 */
export function EchoRipple({
  className,
  style,
  active = true,
}: {
  className?: string;
  style?: React.CSSProperties;
  active?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={clsx('pointer-events-none select-none', className)}
      style={{
        maskImage: 'radial-gradient(circle at center, #000 38%, transparent 68%)',
        WebkitMaskImage: 'radial-gradient(circle at center, #000 38%, transparent 68%)',
        ...style,
      }}
    >
      <svg viewBox="0 0 400 400" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id="echo-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="45%" stopColor="var(--accent)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="200" fill="url(#echo-glow)" />
        {[46, 82, 124, 170].map((r, i) => (
          <circle
            key={r}
            cx="200"
            cy="200"
            r={r}
            fill="none"
            stroke="var(--fg)"
            strokeOpacity={0.07 - i * 0.012}
            strokeWidth="1"
          />
        ))}
        {active &&
          [0, 1, 2].map((i) => (
            <circle
              key={i}
              cx="200"
              cy="200"
              r="150"
              fill="none"
              stroke="var(--accent)"
              strokeOpacity="0.28"
              strokeWidth="1"
              className="motion-ambient"
              style={{
                transformOrigin: '200px 200px',
                animation: `echo-ripple 7.5s cubic-bezier(0.25, 0.6, 0.3, 1) ${i * 2.5}s infinite both`,
              }}
            />
          ))}
      </svg>
    </div>
  );
}

/** Status dot; pulses with an echo ring while work is in progress. */
export function EchoPulse({ tone, pulsing }: { tone: 'idle' | 'busy' | 'ok' | 'warning' | 'error'; pulsing?: boolean }) {
  const color = {
    idle: 'bg-fg-3',
    busy: 'bg-accent',
    ok: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-danger',
  }[tone];
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden="true">
      {pulsing && (
        <span className={clsx('motion-ambient absolute inset-0 rounded-full', color)} style={{ animation: 'echo-pulse 1.8s ease-out infinite' }} />
      )}
      <span className={clsx('relative inline-flex h-2 w-2 rounded-full', color)} />
    </span>
  );
}
