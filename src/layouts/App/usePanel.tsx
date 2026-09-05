'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A dropped panel's open state, keyed to the pathname so navigating away
 * closes it, plus outside-click and Escape dismissal. Shared by the site
 * switcher and the date-range control.
 */
export function usePanel<T extends HTMLElement>(pathname: string) {
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpenedAt(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenedAt(null);
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return {
    ref,
    open,
    toggle: () => setOpenedAt(open ? null : pathname),
    close: () => setOpenedAt(null),
  };
}

export function Chevron() {
  return (
    <svg viewBox="0 0 10 6" aria-hidden>
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
