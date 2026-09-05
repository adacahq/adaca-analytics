'use client';

import { activeGroupAndSection } from '@/lib/nav';
import type { NavGroup } from '@/lib/nav';
import ThemeToggle from '@/components/ui/ThemeToggle';
import SiteSwitcher from './SiteSwitcher';
import DateRange from './DateRange';
import type { SiteOption } from './index';

/** Screens whose content is not a dated report: no range control there. */
function showsRange(pathname: string, sites: SiteOption[], currentSiteId: string | null): boolean {
  if (pathname === '/d/realtime' || pathname === '/d/new' || pathname === '/setup') return false;
  if (pathname.startsWith('/settings')) return false;
  return sites.some((s) => s.id === currentSiteId);
}

/**
 * The topbar: the site switcher on the left (which doubles as the position
 * readout when there is nothing to switch), the date range in the middle,
 * the theme toggle on the right. On mobile it also carries the drawer's
 * menu button — it is the one bar across every viewport.
 */
export default function Topbar({
  sites,
  currentSiteId,
  today,
  groups,
  pathname,
  onMenu,
}: {
  sites: SiteOption[];
  currentSiteId: string | null;
  today: string;
  groups: NavGroup[];
  pathname: string;
  onMenu: () => void;
}) {
  const hit = activeGroupAndSection(groups, pathname);
  const sectionLabel = hit ? hit.group.label ?? hit.section.label : pathname === '/setup' ? 'Setup' : null;

  return (
    <header className="tb">
      <div className="tbl">
        <button type="button" className="tbmenu" onClick={onMenu} aria-label="Open navigation">
          Menu
        </button>
        {sites.length > 0 ? (
          <SiteSwitcher sites={sites} currentSiteId={currentSiteId} pathname={pathname} />
        ) : sectionLabel ? (
          <span className="tbswitch static">
            <span className="tbsect">{sectionLabel}</span>
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 justify-center px-2 min-w-0">
        {showsRange(pathname, sites, currentSiteId) ? <DateRange today={today} pathname={pathname} /> : null}
      </div>
      <div className="tbctl">
        <ThemeToggle />
      </div>
    </header>
  );
}
