import clsx from 'clsx';
import echoIcon from '../../../assets/echo-icon.png';

/**
 * The Echo mark: the product icon (a signal point with receding rings), used
 * for the wordmark, the search home and brand moments.
 */
export function EchoMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <img
      src={echoIcon}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={clsx('shrink-0 select-none object-contain', className)}
    />
  );
}

export function EchoWordmark({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <EchoMark size={24} />
      <span className="font-display text-sm font-semibold tracking-[-0.01em] text-fg">Echo</span>
    </span>
  );
}
