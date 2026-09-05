import { notFound, redirect } from 'next/navigation';
import DashboardGrid from './DashboardGrid';
import IngestBanner from '@/components/ingest/IngestBanner';
import { listSites } from '@/lib/db/sites';
import { getDashboard } from '@/lib/db/dashboards';
import { listActiveRuns } from '@/lib/db/ingestRuns';
import { unitsFor } from '@/lib/analytics/ingest';
import { currentSite, rangeFor, rangeParams, type SearchParams } from '@/lib/context';
import { fmtDay } from '@/lib/format';

/**
 * One dashboard, server side: resolves the site and range, loads the board,
 * and hands the client grid what it needs. Shared by `/` (home) and `/d/[slug]`.
 */
export default async function DashboardScreen({ slug, searchParams }: { slug: string; searchParams: SearchParams }) {
  const sites = await listSites();
  const site = await currentSite(sites);
  if (!site) redirect('/setup');
  const dashboard = await getDashboard(slug);
  if (!dashboard) notFound();

  const range = rangeFor(site, rangeParams(searchParams));
  const active = await listActiveRuns(site.id);
  const progress = active.map((r) => ({
    id: r.id,
    site_id: r.site_id,
    kind: r.kind,
    from: r.from_date,
    to: r.to_date,
    units: r.units,
    total: unitsFor(site, r.from_date, r.to_date),
    rows: r.rows_written,
    status: r.status,
  }));
  const isRealtime = dashboard.slug === 'realtime';
  const lede = isRealtime
    ? `${site.name} · the last 30 minutes, refreshed every half minute.`
    : `${site.name} · ${fmtDay(range.from)} to ${fmtDay(range.to)}${range.compare ? ', compared with the period before' : ''}.`;

  return (
    <div>
      {progress.length > 0 ? (
        <div className="mb-6">
          <IngestBanner siteId={site.id} initial={progress} />
        </div>
      ) : null}
      <DashboardGrid key={`${dashboard.id}:${site.id}`} dashboard={dashboard} siteId={site.id} hasRealtime={!!site.ga_property_id} lede={lede} />
    </div>
  );
}
