'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConfirmProvider } from '@/components/ui/Confirm';
import Logo from '@/components/ui/Logo';
import { navGroups, type DashboardLink } from '@/lib/nav';
import ThemeToggle from '@/components/ui/ThemeToggle';
import Nav from './Nav';
import Topbar from './Topbar';
import DrawerSites from './DrawerSites';
import type { SavedSegmentOption } from './SegmentControl';
import type { PaletteKey } from '@/lib/palette';

export interface SiteOption {
  id: string;
  name: string;
  timezone: string;
  hasRealtime: boolean;
}

/**
 * The shell: `Topbar` (site switcher, date range, theme) across the top, the
 * `.sb` rail down the left (a fixed drawer below 900px — the CSS implements
 * the slide + scrim), and one `.wrap` for every screen underneath.
 *
 * The drawer's open state is keyed to the pathname rather than tracked with
 * an effect: `open` is only true while `openedAt` still equals the current
 * pathname, so navigating away closes it for free.
 */
export default function AppShell({
  sites,
  currentSiteId,
  today,
  earliest,
  palette,
  segments,
  dashboards,
  children,
}: {
  sites: SiteOption[];
  currentSiteId: string | null;
  /** Today's calendar day in the current site's timezone (server-computed). */
  today: string;
  /** The current site's first day of data, for "All time". */
  earliest: string | null;
  /** The deployment's chart palette, stamped on the wrapper for the CSS ramps. */
  palette: PaletteKey;
  segments: SavedSegmentOption[];
  dashboards: DashboardLink[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '/';
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const groups = navGroups(dashboards);

  return (
    <div data-palette={palette}>
      <Topbar
        sites={sites}
        currentSiteId={currentSiteId}
        today={today}
        earliest={earliest}
        segments={segments}
        groups={groups}
        pathname={pathname}
        menuOpen={open}
        onMenu={() => setOpenedAt(open ? null : pathname)}
      />
      {open ? <div className="scrim" onClick={() => setOpenedAt(null)} aria-hidden /> : null}
      <aside className={open ? 'sb open' : 'sb'}>
        <Link href="/" className="brand">
          <Logo variant="white" />
          <span>Analytics</span>
        </Link>
        <Nav groups={groups} />
        {/* Drawer-only foot: the site picker and the theme toggle, both of which
            leave the topbar on small screens. */}
        <div className="sbfoot">
          <DrawerSites sites={sites} currentSiteId={currentSiteId} onDone={() => setOpenedAt(null)} />
          <div className="sbtgl">
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <main className="page min-h-svh">
        <div className="wrap">
          <ConfirmProvider>{children}</ConfirmProvider>
        </div>
      </main>
    </div>
  );
}
