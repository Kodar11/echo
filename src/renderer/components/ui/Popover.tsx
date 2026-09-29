import clsx from 'clsx';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement>;
  align?: 'start' | 'end';
  /** Width in px; defaults to content width. */
  width?: number;
  className?: string;
  /** Accessible label for the dialog-like surface. */
  label?: string;
  role?: 'dialog' | 'menu' | 'listbox';
  children: ReactNode;
}

/**
 * A small floating surface anchored to a trigger. Closes on outside click and
 * Escape, returns focus to the trigger, and flips above the anchor when there
 * is no room below.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  align = 'start',
  width,
  className,
  label,
  role = 'dialog',
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const a = anchor.getBoundingClientRect();
      const w = width ?? panel.offsetWidth;
      const h = panel.offsetHeight;
      const margin = 8;
      let left = align === 'end' ? a.right - w : a.left;
      left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
      let top = a.bottom + 6;
      if (top + h > window.innerHeight - margin && a.top - h - 6 > margin) top = a.top - h - 6;
      setStyle({ left, top, width, maxHeight: window.innerHeight - top - margin });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, anchorRef, align, width]);

  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        anchor?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    // Move focus into the panel for keyboard users.
    requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        '[data-autofocus], [role="menuitem"], [role="option"], button, input, [tabindex="0"]'
      );
      first?.focus({ preventScroll: true });
    });
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-label={label}
      style={style}
      className={clsx(
        'animate-pop-in fixed z-[90] overflow-auto rounded-lg border border-line bg-raised shadow-pop',
        className
      )}
    >
      {children}
    </div>,
    document.body
  );
}
