'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from '@/components/ui/ThemeToggle';

/**
 * On-brand sonner toaster: ultra-dark hairline surface, square corners, no
 * shadow, mono-ish messaging, orange accent for success / crit for error, and a
 * persistent close button. Colours come from CSS tokens (see globals.css) so it
 * tracks the theme (via the single `useTheme` source — see ThemeToggle.tsx).
 * Mounted once in the root layout.
 */
export default function Toaster() {
  const dark = useTheme();
  return (
    <SonnerToaster
      theme={dark ? 'dark' : 'light'}
      position="bottom-right"
      closeButton
      gap={10}
      offset={20}
      toastOptions={{
        style: {
          background: 'var(--card)',
          border: '1px solid var(--card-line)',
          borderRadius: 0,
          boxShadow: 'none',
          color: 'var(--fg)',
          fontSize: '13px',
          fontFamily: 'inherit',
        },
      }}
    />
  );
}
