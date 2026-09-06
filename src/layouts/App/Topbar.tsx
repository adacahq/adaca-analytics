'use client';

import { activeGroupAndSection } from '@/lib/nav';
import type { NavGroup } from '@/lib/nav';
import ThemeToggle from '@/components/ui/ThemeToggle';
import SiteSwitcher from './SiteSwitcher';
import DateRange from './DateRange';
import SegmentControl, { type SavedSegmentOption } from './SegmentControl';
import LiveChip from './LiveChip';
import type { SiteOption } from './index';

/** Screens whose content is not a dated report: no range control there. */
function showsRange(pathname: string, sites: SiteOption[], currentSiteId: string | null): boolean {
  if (pathname === '/d/realtime' || pathname === '/d/new' || pathname === '/setup') return false;
  if (pathname.startsWith('/settings')) return false;
  return sites.some((s) => s.id === currentSiteId);
}

/** The filter applies to dashboards and the explore page; a detail page is already one dimension. */
function showsFilter(pathname: string): boolean {
  return !pathname.startsWith('/detail/');
}

/**
 * The topbar: the site switcher on the left (which doubles as the position
 * readout when there is nothing to switch), the period and the filter in the
 * middle, the live count and the theme toggle on the right. On mobile it
 * also carries the drawer's menu button — it is the one bar across every
 * viewport.
 */
export default function Topbar({
  sites,
  currentSiteId,
  today,
  earliest,
  segments,
  groups,
  pathname,
  onMenu,
}: {
  sites: SiteOption[];
  currentSiteId: string | null;
  today: string;
  earliest: string | null;
  segments: SavedSegmentOption[];
  groups: NavGroup[];
  pathname: string;
  onMenu: () => void;
}) {
  const hit = activeGroupAndSection(groups, pathname);
  const sectionLabel = hit ? hit.group.label ?? hit.section.label : pathname === '/setup' ? 'Setup' : null;
  const site = sites.find((s) => s.id === currentSiteId) ?? null;
  const dated = showsRange(pathname, sites, currentSiteId);

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
      <div className="tbmid">
        {dated ? <DateRange today={today} earliest={earliest} pathname={pathname} /> : null}
        {dated && site && showsFilter(pathname) ? <SegmentControl siteId={site.id} saved={segments} pathname={pathname} /> : null}
      </div>
      {site?.hasRealtime && pathname !== '/setup' ? (
        <div className="tbctl live">
          <LiveChip siteId={site.id} />
        </div>
      ) : null}
      <div className="tbctl">
        <ThemeToggle />
      </div>
    </header>
  );
}
