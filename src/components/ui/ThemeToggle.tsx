'use client';

import { useSyncExternalStore } from 'react';

/**
 * Light/dark, the operator's choice and nothing else — the theme does not
 * track where you are in the hierarchy. The stored choice is stamped on
 * <html data-theme> before paint by the root layout's theme gate
 * (`src/app/layout.tsx`); the DOM attribute is the single source of truth,
 * subscribed to directly via a MutationObserver rather than a bespoke custom
 * event. `useTheme()` is exported so every consumer (this toggle, `Toaster`)
 * reads the same snapshot instead of re-deriving it.
 */
function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => mo.disconnect();
}

function snapshot(): boolean {
  return document.documentElement.dataset.theme === 'dark';
}

/** True while dark is active. Light is the default (`getServerSnapshot`
 *  matches the root layout's `data-theme="light"` before the pre-paint
 *  script runs). */
export function useTheme(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

export default function ThemeToggle() {
  const dark = useTheme();

  function toggle() {
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    try {
      localStorage.setItem('analytics-theme', dark ? 'light' : 'dark');
    } catch {
      // Private mode: the choice just doesn't persist.
    }
  }

  return (
    <button
      type="button"
      className="tgl"
      onClick={toggle}
      aria-pressed={dark}
      title="Switch between light and dark"
    >
      <em className={dark ? undefined : 'live'}>Light</em>
      <em className={dark ? 'live' : undefined}>Dark</em>
    </button>
  );
}
