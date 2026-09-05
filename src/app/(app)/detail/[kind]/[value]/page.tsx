import type { CSSProperties } from 'react';
import { notFound, redirect } from 'next/navigation';
import EntityHeader from '@/components/detail/EntityHeader';
import EntityKpis from '@/components/detail/EntityKpis';
import EntityTrend from '@/components/detail/EntityTrend';
import BreakdownCard from '@/components/detail/BreakdownCard';
import { listSites } from '@/lib/db/sites';
import { currentSite, rangeFor, rangeParams, type SearchParams } from '@/lib/context';
import { ENTITY_BY_KIND, entityTitle, isEntityKind } from '@/lib/analytics/entities';
import { loadEntity } from '@/lib/analytics/drill';
import { rangeToQuery } from '@/lib/analytics/ranges';
import { METRIC_BY_KEY } from '@/lib/analytics/metrics';
import { fmtDay, fmtPercent } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** A route segment as the router hands it over, decoded once (a literal `%2F` is the page "/"). */
function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * An entity page: one value of one dimension, with its KPIs, trend and every
 * precomputed breakdown, rendered from a single D1 round trip.
 */
export default async function DetailPage({ params, searchParams }: { params: Promise<{ kind: string; value: string }>; searchParams: Promise<SearchParams> }) {
  const { kind, value: rawValue } = await params;
  if (!isEntityKind(kind)) notFound();
  const value = decodeSegment(rawValue);
  const sites = await listSites();
  const site = await currentSite(sites);
  if (!site) redirect('/setup');

  const range = rangeFor(site, rangeParams(await searchParams));
  const def = ENTITY_BY_KIND[kind];
  const data = await loadEntity(site, kind, value, range);
  const query = rangeToQuery(range).toString();
  const lead = METRIC_BY_KEY[def.lead];
  const title = entityTitle(kind, value);

  const lede = data.found
    ? `${site.name} · ${fmtDay(range.from)} to ${fmtDay(range.to)}${data.share !== null ? ` · ${fmtPercent(data.share)} of the site’s ${lead.label.toLowerCase()}` : ''}${range.compare ? ' · compared with the period before' : ''}.`
    : `${site.name} · ${fmtDay(range.from)} to ${fmtDay(range.to)} · nothing recorded for this ${def.label.toLowerCase()} in the period.`;

  return (
    <div className="detail">
      <EntityHeader kindLabel={def.label} title={title} mono={def.mono} lede={lede} />

      {data.found ? (
        <>
          <div className="rv" style={{ '--i': 2 } as CSSProperties}>
            <EntityKpis kpis={data.kpis} />
          </div>
          <div className="rv mt-6" style={{ '--i': 3 } as CSSProperties}>
            <EntityTrend metricKey={def.lead} bucket={data.trend.bucket} points={data.trend.points} title={`${lead.label} over time`} />
          </div>
          {data.breakdowns.length > 0 ? (
            <div className="rv mt-6" style={{ '--i': 4 } as CSSProperties}>
              {data.pairsMissing ? (
                <p className="wnote-hint">
                  No drill-down data for this site yet. Open <a href="/settings/ingestion">Settings → Ingestion</a> and press <b>Add drill-down data</b> to precompute the breakdowns below.
                </p>
              ) : null}
              <div className="bgrid">
                {data.breakdowns.map((b) => (
                  <BreakdownCard key={b.label} breakdown={b} query={query} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty rv mt-8" style={{ '--i': 2 } as CSSProperties}>
          <span className="zone-label">{def.label}</span>
          <p>
            No rows for <b className={def.mono ? 'mono' : undefined}>{title}</b> between {fmtDay(range.from)} and {fmtDay(range.to)}. Try a wider period, or check the site holds data for these days.
          </p>
        </div>
      )}
    </div>
  );
}
