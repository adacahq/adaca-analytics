import { notFound } from 'next/navigation';
import ShareShell from '@/components/share/ShareShell';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import { getShareByToken } from '@/lib/db/shares';
import { getDashboardById } from '@/lib/db/dashboards';
import { getSite } from '@/lib/db/sites';
import { rangeFor, rangeParams, type SearchParams } from '@/lib/context';
import { compareNoun, todayInZone, type RangeParams } from '@/lib/analytics/ranges';
import { parseSegment, segmentLabel } from '@/lib/analytics/segments';
import { earliestDate } from '@/lib/analytics/rollups';
import { fmtDay } from '@/lib/format';

export const dynamic = 'force-dynamic';

function lockOf(raw: string | null): RangeParams | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RangeParams;
  } catch {
    return null;
  }
}

/**
 * A shared dashboard: read-only, outside the app shell, reachable without
 * the deployment's gate (worker/index.ts opens /share/* for GET). Widgets
 * load through /api/share/<token>/widget, which serves only this dashboard
 * for this site, with the link's locked period and pinned filter.
 */
export default async function SharePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<SearchParams> }) {
  const { token } = await params;
  const share = await getShareByToken(token);
  if (!share) notFound();
  const [site, dashboard] = await Promise.all([getSite(share.site_id), getDashboardById(share.dashboard_id)]);
  if (!site || !dashboard) notFound();

  const sp = await searchParams;
  const lock = lockOf(share.lock_range);
  const range = await rangeFor(site, lock ?? rangeParams(sp));
  const seg = share.seg ? parseSegment(share.seg) : null;
  const today = todayInZone(site.timezone);
  const earliest = await earliestDate(site.id);
  const embed = (Array.isArray(sp.embed) ? sp.embed[0] : sp.embed) === '1';
  const isRealtime = dashboard.slug === 'realtime';
  const lede = isRealtime
    ? `${site.name} · the last 30 minutes, refreshed every half minute.`
    : `${site.name} · ${fmtDay(range.from)} to ${fmtDay(range.to)}${range.compare ? `, compared with ${compareNoun(range, fmtDay)}` : ''}${seg ? ` · ${segmentLabel(seg)}` : ''}.`;

  return (
    <ShareShell token={token} locked={!!lock || isRealtime} embed={embed} siteName={site.name} today={today} earliest={earliest}>
      <DashboardGrid key={`${dashboard.id}:${site.id}`} dashboard={dashboard} siteId={site.id} hasRealtime={!!site.ga_property_id} lede={lede} readonly />
    </ShareShell>
  );
}
