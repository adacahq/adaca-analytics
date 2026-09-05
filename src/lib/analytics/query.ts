/**
 * The query engine: widget config + range → render-ready WidgetData.
 * Reads the rollups in D1; routes realtime datasets to `live.ts`; and, for
 * the one metric that cannot be summed across days (unique visitors), asks
 * GA for the exact figure when the site has a property.
 */
import { db, kv } from '@/lib/db/client';
import type { Site } from '@/lib/db/sites';
import type { Bucket, ChartType, WidgetConfig, WidgetData, Point } from '@/lib/dashboard/types';
import { DATASET_BY_KEY, isOrdinal, type Dataset } from './catalog';
import { isMetricKey, metricValue, METRIC_BY_KEY, type MetricKey } from './metrics';
import { METRIC_COLUMNS, type MetricColumn } from './reports';
import { autoBucket, eachDay, previousPeriod, type DateRange } from './ranges';
import { rankedSql, timeseriesSql, totalsSql, weekdaySql, type Stmt } from './query-sql';
import { runRealtime } from './live';
import { runReport } from '@/lib/google/ga4';
import { fmtDow, fmtHour } from '@/lib/format';

type Sums = Partial<Record<MetricColumn, number>>;

async function one(stmt: Stmt): Promise<Sums> {
  const row = await db().prepare(stmt.sql).bind(...stmt.params).first<Record<string, number>>();
  return (row ?? {}) as Sums;
}

async function many<T extends Record<string, unknown>>(stmt: Stmt): Promise<T[]> {
  const { results } = await db().prepare(stmt.sql).bind(...stmt.params).all<T>();
  return results;
}

function metricOf(config: WidgetConfig, ds: Dataset): MetricKey {
  return isMetricKey(config.metric) && ds.metrics.includes(config.metric) ? config.metric : ds.defaultMetric;
}

function labelFor(ds: Dataset, raw: string): string {
  if (ds.key === 'behaviour.hours') return fmtHour(raw);
  if (ds.key === 'behaviour.weekdays') return fmtDow(Number(raw));
  if (ds.key === 'realtime.minutes') return `${raw}m`;
  if (ds.key === 'audience.userType') return raw === 'new' ? 'New' : raw === 'returning' ? 'Returning' : raw;
  return raw || '(not set)';
}

/**
 * Exact unique visitors over a window from GA (rollups hold daily uniques,
 * whose sum over-counts anyone who came back). Cached 10 minutes. Falls
 * back to the daily sum when the site has no property or GA is unreachable.
 */
async function exactUsers(site: Site, metric: 'users' | 'newUsers', from: string, to: string, fallback: number): Promise<number> {
  if (!site.ga_property_id) return fallback;
  const key = `uniques:${site.ga_property_id}:${metric}:${from}:${to}`;
  try {
    const cached = await kv().get(key);
    if (cached !== null) return Number(cached);
  } catch {
    // fall through
  }
  try {
    const res = await runReport(site.ga_property_id, {
      dimensions: [],
      metrics: [metric === 'users' ? 'activeUsers' : 'newUsers'],
      dateRanges: [{ startDate: from, endDate: to }],
      limit: 1,
    });
    const v = res.rows[0]?.mets[0] ?? 0;
    try {
      await kv().put(key, String(v), { expirationTtl: 600 });
    } catch {
      // not fatal
    }
    return v;
  } catch {
    return fallback;
  }
}

async function kpi(site: Site, ds: Dataset, config: WidgetConfig, range: DateRange): Promise<WidgetData> {
  const metric = metricOf(config, ds);
  const cur = await one(totalsSql(site.id, ds, range.from, range.to, config.filters));
  let value = metricValue(metric, cur);
  let previous: number | null = null;
  const prevRange = previousPeriod(range);
  if (config.compare !== false) {
    const prev = await one(totalsSql(site.id, ds, prevRange.from, prevRange.to, config.filters));
    previous = metricValue(metric, prev);
  }
  // Exact uniques only make sense site-wide (no dimension filter narrowing them).
  if (ds.key === 'overview.totals' && (metric === 'users' || metric === 'newUsers') && !(config.filters ?? []).some((f) => f.value)) {
    value = await exactUsers(site, metric, range.from, range.to, value);
    if (previous !== null) previous = await exactUsers(site, metric, prevRange.from, prevRange.to, previous);
  }
  // Sparkline: daily values across the range (capped to ~90 points by bucketing).
  const bucket = autoBucket(range);
  const rows = await many<{ name: string } & Record<string, number>>(timeseriesSql(site.id, ds, range.from, range.to, bucket, config.filters));
  const spark = rows.map((r) => metricValue(metric, r as Sums));
  return { kind: 'kpi', value, previous, spark };
}

function fillDays(points: Point[], from: string, to: string, bucket: Bucket): Point[] {
  if (bucket !== 'day') return points;
  const byName = new Map(points.map((p) => [p.name, p]));
  return eachDay(from, to).map((d) => byName.get(d) ?? { name: d, value: 0 });
}

async function timeseries(site: Site, ds: Dataset, config: WidgetConfig, range: DateRange): Promise<WidgetData> {
  const metric = metricOf(config, ds);
  const bucket = config.bucket ?? autoBucket(range);
  const rows = await many<{ name: string } & Record<string, number>>(timeseriesSql(site.id, ds, range.from, range.to, bucket, config.filters));
  let points: Point[] = fillDays(
    rows.map((r) => ({ name: r.name, value: metricValue(metric, r as Sums) })),
    range.from,
    range.to,
    bucket,
  );
  if (config.compare) {
    const prev = previousPeriod(range);
    const prows = await many<{ name: string } & Record<string, number>>(timeseriesSql(site.id, ds, prev.from, prev.to, bucket, config.filters));
    const pvals = fillDays(
      prows.map((r) => ({ name: r.name, value: metricValue(metric, r as Sums) })),
      prev.from,
      prev.to,
      bucket,
    );
    // Align by position: day i of this period against day i of the last.
    points = points.map((p, i) => ({ ...p, previous: pvals[i]?.value ?? 0 }));
  }
  return { kind: 'timeseries', bucket, points };
}

async function ranked(site: Site, ds: Dataset, config: WidgetConfig, range: DateRange, defaultLimit: number): Promise<WidgetData> {
  const metric = metricOf(config, ds);
  const sortMetric = isMetricKey(config.sort?.metric) && ds.metrics.includes(config.sort!.metric as MetricKey) ? (config.sort!.metric as MetricKey) : metric;
  const dir = config.sort?.dir ?? 'desc';
  const limit = Math.min(200, Math.max(1, config.limit ?? defaultLimit));
  let rows: ({ name: string; sub?: string } & Record<string, number | string>)[];
  if (ds.key === 'behaviour.weekdays') {
    rows = await many(weekdaySql(site.id, ds, range.from, range.to, config.filters));
  } else if (isOrdinal(ds)) {
    // Hours: every bucket in natural order, not top-N.
    rows = await many(rankedSql(site.id, ds, range.from, range.to, { sortMetric, dir: 'asc', limit: 200, filters: config.filters }));
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } else {
    rows = await many(rankedSql(site.id, ds, range.from, range.to, { sortMetric, dir, limit, filters: config.filters }));
  }
  const totals = await one(totalsSql(site.id, ds, range.from, range.to, config.filters));
  const total = metricValue(metric, totals);
  const out = rows.map((r) => {
    const value = metricValue(metric, r as Sums);
    return {
      key: labelFor(ds, String(r.name)),
      sub: ds.subDim && r.sub !== undefined ? String(r.sub) : undefined,
      value,
      share: total > 0 && METRIC_BY_KEY[metric].kind === 'sum' ? value / total : 0,
    };
  });
  return { kind: 'ranked', rows: out, total };
}

async function table(site: Site, ds: Dataset, config: WidgetConfig, range: DateRange): Promise<WidgetData> {
  const metric = metricOf(config, ds);
  const cols = (config.metrics ?? []).filter((m): m is MetricKey => isMetricKey(m) && ds.metrics.includes(m));
  const metrics: MetricKey[] = cols.length ? cols : [metric, ...ds.metrics.filter((m) => m !== metric).slice(0, 3)];
  const sortMetric = isMetricKey(config.sort?.metric) && metrics.includes(config.sort!.metric as MetricKey) ? (config.sort!.metric as MetricKey) : metrics[0];
  const dir = config.sort?.dir ?? 'desc';
  const limit = Math.min(500, Math.max(1, config.limit ?? 25));
  let rows: ({ name: string; sub?: string } & Record<string, number | string>)[];
  if (ds.dim === 'none' && ds.key !== 'behaviour.weekdays') {
    // Totals as a table = one row per bucket.
    const bucket = config.bucket ?? autoBucket(range);
    rows = await many(timeseriesSql(site.id, ds, range.from, range.to, bucket, config.filters));
    if (dir === 'desc') rows.reverse();
  } else if (ds.key === 'behaviour.weekdays') {
    rows = await many(weekdaySql(site.id, ds, range.from, range.to, config.filters));
  } else {
    rows = await many(rankedSql(site.id, ds, range.from, range.to, { sortMetric, dir, limit, filters: config.filters }));
  }
  return {
    kind: 'table',
    columns: [{ key: 'name', label: ds.dimLabel, metric: false }, ...metrics.map((m) => ({ key: m, label: METRIC_BY_KEY[m].short, metric: true }))],
    rows: rows.map((r) => {
      const out: Record<string, string | number> = { name: labelFor(ds, String(r.name)) };
      if (ds.subDim && r.sub !== undefined) out.sub = String(r.sub);
      for (const m of metrics) out[m] = metricValue(m, r as Sums);
      return out;
    }),
  };
}

/** The entry point every widget goes through. */
export async function runWidgetQuery(site: Site, type: ChartType, config: WidgetConfig, range: DateRange): Promise<WidgetData> {
  if (type === 'note') return { kind: 'empty' };
  const ds = config.dataset ? DATASET_BY_KEY[config.dataset] : undefined;
  if (!ds) return { kind: 'empty', reason: 'Choose what to show' };
  if (ds.live) return runRealtime(site, ds, type, config);

  switch (type) {
    case 'kpi':
      return kpi(site, ds, config, range);
    case 'line':
      return isOrdinal(ds) ? ranked(site, ds, config, range, 200) : timeseries(site, ds, config, range);
    case 'column':
    case 'bar':
      return ds.dim === 'none' && ds.key !== 'behaviour.weekdays' ? timeseries(site, ds, config, range) : ranked(site, ds, config, range, type === 'bar' ? 10 : 12);
    case 'donut':
      return ranked(site, ds, config, range, 6);
    case 'list':
      return ranked(site, ds, config, range, 10);
    case 'table':
      return table(site, ds, config, range);
    default:
      return { kind: 'empty' };
  }
}

/** Column keys a metric needs, for callers that want to project rows themselves. */
export const COLUMNS = METRIC_COLUMNS;
