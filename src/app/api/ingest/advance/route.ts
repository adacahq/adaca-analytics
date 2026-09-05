import { pump } from '@/lib/analytics/ingest';
import { listActiveRuns } from '@/lib/db/ingestRuns';
import { listSites } from '@/lib/db/sites';
import { unitsFor } from '@/lib/analytics/ingest';

/**
 * The browser-side pump. The setup wizard and the ingestion page call this
 * in a loop while a run is active so a backfill finishes in minutes rather
 * than waiting for cron ticks. Each call does a bounded amount of work and
 * reports progress for every active run.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const siteId = url.searchParams.get('site') ?? undefined;
  const result = await pump({ siteId, budgetMs: 12_000, maxUnits: 8 });
  const runs = await listActiveRuns(siteId);
  const sites = new Map((await listSites()).map((s) => [s.id, s]));
  const progress = runs.map((r) => {
    const site = sites.get(r.site_id);
    const total = site ? unitsFor(site, r.from_date, r.to_date) : 0;
    return { id: r.id, site_id: r.site_id, kind: r.kind, from: r.from_date, to: r.to_date, units: r.units, total, rows: r.rows_written, status: r.status };
  });
  return Response.json({ ...result, progress }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  // Progress without doing work (the banner polls this when it isn't the pump owner).
  const url = new URL(request.url);
  const siteId = url.searchParams.get('site') ?? undefined;
  const runs = await listActiveRuns(siteId);
  const sites = new Map((await listSites()).map((s) => [s.id, s]));
  const progress = runs.map((r) => {
    const site = sites.get(r.site_id);
    const total = site ? unitsFor(site, r.from_date, r.to_date) : 0;
    return { id: r.id, site_id: r.site_id, kind: r.kind, from: r.from_date, to: r.to_date, units: r.units, total, rows: r.rows_written, status: r.status };
  });
  return Response.json({ progress }, { headers: { 'Cache-Control': 'no-store' } });
}
