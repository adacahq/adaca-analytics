import type { CSSProperties } from 'react';
import { notFound, redirect } from 'next/navigation';
import EntityHeader from '@/components/detail/EntityHeader';
import ExploreView from '@/components/explore/ExploreView';
import { listSites } from '@/lib/db/sites';
import { currentSite, rangeFor, rangeParams, segmentFor, type SearchParams } from '@/lib/context';
import { CATEGORIES, DATASET_BY_KEY } from '@/lib/analytics/catalog';
import { isMetricKey, METRIC_BY_KEY, type MetricKey } from '@/lib/analytics/metrics';
import { runWidgetQuery } from '@/lib/analytics/query';
import { compareNoun } from '@/lib/analytics/ranges';
import { OP_WORDS, segmentLabel } from '@/lib/analytics/segments';
import type { Filter, FilterOp } from '@/lib/dashboard/types';
import { fmtDay } from '@/lib/format';

export const dynamic = 'force-dynamic';

const OPS = new Set<FilterOp>(['eq', 'neq', 'contains', 'not_contains']);

/** Widget filters carried as JSON in `?f=`; anything malformed is dropped rather than thrown. */
function parseFilters(raw: string | undefined): Filter[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((f): f is Filter => !!f && typeof f === 'object' && ((f as Filter).dim === 'key1' || (f as Filter).dim === 'key2') && OPS.has((f as Filter).op) && typeof (f as Filter).value === 'string')
      .slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * The explore page: one dataset, every row and metric for the period, under
 * the dashboard filter if one is set. Reached from "See all" on any card
 * and from every breakdown of a detail page.
 */
export default async function ExplorePage({ params, searchParams }: { params: Promise<{ dataset: string }>; searchParams: Promise<SearchParams> }) {
  const { dataset } = await params;
  const ds = DATASET_BY_KEY[decodeURIComponent(dataset)];
  if (!ds || ds.live) notFound();
  const sites = await listSites();
  const site = await currentSite(sites);
  if (!site) redirect('/setup');

  const sp = await searchParams;
  const rp = rangeParams(sp);
  const range = await rangeFor(site, rp);
  const segment = segmentFor(rp);
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const metric: MetricKey = isMetricKey(one('metric')) && ds.metrics.includes(one('metric') as MetricKey) ? (one('metric') as MetricKey) : ds.defaultMetric;
  const filters = parseFilters(one('f'));

  const [data, totals] = await Promise.all([
    runWidgetQuery(site, 'table', { dataset: ds.key, metrics: ds.metrics, metric, filters, sort: { metric, dir: 'desc' }, limit: 500 }, range, segment),
    runWidgetQuery(site, 'kpi', { dataset: ds.key, metric, filters, compare: false }, range, segment),
  ]);
  const category = CATEGORIES.find((c) => c.key === ds.category)?.label ?? 'Data';
  const filterText = filters
    .filter((f) => f.value)
    .map((f) => `${f.dim === 'key2' ? 'second dimension' : ds.dimLabel} ${OP_WORDS[f.op]} ${f.value}`)
    .join(', ');
  const lede = `${site.name} · ${fmtDay(range.from)} to ${fmtDay(range.to)}${range.compare ? ` · compared with ${compareNoun(range, fmtDay)}` : ''}${segment ? ` · ${segmentLabel(segment)}` : ''}${filterText ? ` · ${filterText}` : ''} · by ${METRIC_BY_KEY[metric].label.toLowerCase()}.`;

  return (
    <div className="detail">
      <EntityHeader kindLabel={category} title={ds.label} mono={false} lede={lede} />
      <div className="rv mt-6" style={{ '--i': 2 } as CSSProperties}>
        {data.kind === 'table' ? (
          <ExploreView datasetKey={ds.key} columns={data.columns} rows={data.rows} metric={metric} total={totals.kind === 'kpi' ? totals.value : 0} />
        ) : (
          <div className="empty">
            <span className="zone-label">{ds.label}</span>
            <p>{data.kind === 'empty' && data.reason ? data.reason : 'Nothing to show for this period.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
