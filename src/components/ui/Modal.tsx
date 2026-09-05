'use client';

import { useEffect, useRef, type ReactNode } from 'react';

const DEFAULT_WIDTH = 520; // `.modal`'s own width; anything else is set inline

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * On-brand modal: dark scrim, hairline panel, mono header — the Canvas
 * `.overlay` → `.modal`/`.modal.wide` → `.mhead`/`.mbody`/`.mfoot` grammar
 * (globals.css), plain React instead of Headless UI's Dialog.
 *
 * `maxWidth` is Red's own prop and callers pass deliberate, arbitrary pixel
 * widths (540, 560, 620, 640, 860…). We honour each exactly rather than
 * snapping to the two CSS presets: bucketing "up to the next size that
 * fits" turned a 540px modal into a 760px one, which is a redesign of six
 * screens dressed up as a restyle. `.modal` keeps `max-width: 100%`, so
 * narrow viewports still clamp.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = DEFAULT_WIDTH,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Prefer an explicit `autoFocus` element (e.g. Confirm's primary action) —
    // Headless UI's Dialog resolved initial focus the same way — falling back
    // to the first focusable element, then the panel itself.
    const autofocused = panel?.querySelector<HTMLElement>('[autofocus]');
    const first = autofocused ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const head = items[0];
      const tail = items[items.length - 1];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="modal"
        style={maxWidth === DEFAULT_WIDTH ? undefined : { width: maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="mhead">
          <h2 className="mtitle">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="mbody">{children}</div>
        {footer ? <div className="mfoot">{footer}</div> : null}
      </div>
    </div>
  );
}
