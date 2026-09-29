import clsx from 'clsx';
import echoIcon from '../../../assets/echo-icon.png';

/**
 * The Echo mark: the product icon (a search lens sending out ripples), used
 * for the wordmark, the search home and brand moments. The artwork is a
 * full-bleed square, so it is clipped to the app-icon corner radius.
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
      style={{ borderRadius: Math.round(size * 0.22) }}
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
