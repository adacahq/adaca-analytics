'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Logo from '@/components/ui/Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import DateRange from '@/layouts/App/DateRange';
import { ShareProvider } from '@/components/dashboard/ShareContext';
import type { PaletteKey } from '@/lib/palette';

/**
 * The chrome of a shared dashboard: no rail, no site switcher, no filter —
 * just the mark, the site's name, the period (unless the link locks it) and
 * the theme toggle. `embed` (from `?embed=1`) drops the bar for iframes.
 */
export default function ShareShell({
  token,
  locked,
  embed,
  siteName,
  today,
  earliest,
  palette,
  children,
}: {
  token: string;
  locked: boolean;
  embed: boolean;
  siteName: string;
  today: string;
  earliest: string | null;
  palette: PaletteKey;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? `/share/${token}`;
  return (
    <ShareProvider value={{ token, locked }}>
      <div className={embed ? 'share-root embed' : 'share-root'} data-palette={palette}>
        <header className="tb">
          <div className="tbl">
            <span className="share-brand">
              <Logo />
              <span>Analytics</span>
            </span>
            <span className="tbswitch static">
              <span className="tbsect">Site</span>
              <b>{siteName}</b>
            </span>
          </div>
          <div className="tbmid">{locked ? null : <DateRange today={today} earliest={earliest} pathname={pathname} />}</div>
          <div className="tbctl">
            <ThemeToggle />
          </div>
        </header>
        <main className="page min-h-svh">
          <div className="wrap">{children}</div>
        </main>
      </div>
    </ShareProvider>
  );
}
