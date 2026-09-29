import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label: string;
  /** Optional keyboard shortcut shown next to the label. */
  shortcut?: string;
  side?: 'top' | 'bottom';
  children: ReactElement;
}

type Handler = (e: SyntheticEvent) => void;

/**
 * Lightweight tooltip for icon-only controls. Rendered in a portal with fixed
 * positioning so scroll containers never clip it; shown on hover (after a
 * short delay) and on keyboard focus.
 */
export function Tooltip({ label, shortcut, side = 'bottom', children }: TooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number; side: 'top' | 'bottom' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const show = useCallback(
    (target: HTMLElement, delay: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const flip = side === 'bottom' && rect.bottom + 40 > window.innerHeight;
        const actual = flip ? 'top' : side;
        setPos({
          x: rect.left + rect.width / 2,
          y: actual === 'bottom' ? rect.bottom + 6 : rect.top - 6,
          side: actual,
        });
      }, delay);
    },
    [side]
  );

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  }, []);

  useEffect(() => () => hide(), [hide]);

  const props = children.props as Record<string, Handler | undefined>;
  const chain = (name: string, fn: Handler): Handler => (e) => {
    props[name]?.(e);
    fn(e);
  };

  return (
    <>
      {cloneElement(children, {
        'aria-describedby': pos ? id : undefined,
        onMouseEnter: chain('onMouseEnter', (e) => show(e.currentTarget as HTMLElement, 450)),
        onMouseLeave: chain('onMouseLeave', hide),
        onFocus: chain('onFocus', (e) => {
          if ((e.currentTarget as HTMLElement).matches(':focus-visible')) show(e.currentTarget as HTMLElement, 0);
        }),
        onBlur: chain('onBlur', hide),
        onMouseDown: chain('onMouseDown', hide),
      } as Record<string, unknown>)}
      {pos &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="animate-fade-in pointer-events-none fixed z-[100] flex items-center gap-2 whitespace-nowrap rounded-sm border border-line bg-raised px-2 py-1 text-xs text-fg shadow-pop"
            style={{
              left: Math.min(Math.max(pos.x, 60), window.innerWidth - 60),
              top: pos.y,
              transform: `translate(-50%, ${pos.side === 'top' ? '-100%' : '0'})`,
            }}
          >
            {label}
            {shortcut && <span className="text-fg-3">{shortcut}</span>}
          </div>,
          document.body
        )}
    </>
  );
}
