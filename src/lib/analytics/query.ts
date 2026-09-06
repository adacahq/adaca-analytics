/**
 * The query engine: widget config + range (+ the dashboard-wide segment) →
 * render-ready WidgetData. Reads the rollups in D1; routes realtime datasets
 * to `live.ts`; and, for the one metric that cannot be summed across days
 * (unique visitors), asks GA for the exact figure when the site has a property.
 */
import { db, kv } from '@/lib/db/client';
import type { Site } from '@/lib/db/sites';
import type { Bucket, ChartType, Filter, WidgetConfig, WidgetData, Point } from '@/lib/dashboard/types';
import { DATASET_BY_KEY, isOrdinal, type Dataset } from './catalog';
import { isMetricKey, metricValue, METRIC_BY_KEY, type MetricKey } from './metrics';
import { METRIC_COLUMNS, type MetricColumn } from './reports';
import { autoBucket, comparisonPeriod, eachDay, eachHour, hourInZone, isHourly, todayInZone, type DateRange } from './ranges';
import { hourlySql, rankedSql, timeseriesSql, totalsSql, weekdaySql, type Stmt } from './query-sql';
import { gaFilterFor, scopeFor, segmentParam, segmentScope, type Scope, type Segment } from './segments';
import { runRealtime } from './live';
import { runReport } from '@/lib/google/ga4';
import { fmtDow, fmtHour } from '@/lib/format';

type Sums = Partial<Record<MetricColumn, number>>;
type Row = { name: string; sub?: string } & Record<string, number | string>;

async function one(stmt: Stmt): Promise<Sums> {
  const row = await db().prepare(stmt.sql).bind(...stmt.params).first<Record<string, number>>();
  return (row ?? {}) as Sums;
}

async function many<T extends Record<string, unknown>>(stmt: Stmt): Promise<T[]> {
  const { results } = await db().prepare(stmt.sql).bind(...stmt.params).all<T>();
  return results;
}

function metricOf(config: WidgetConfig, ds: Dataset, scope?: Scope): MetricKey {
  const key = isMetricKey(config.metric) && ds.metrics.includes(config.metric) ? config.metric : ds.defaultMetric;
  return scope?.eventCountAsKeyEvents && key === 'eventCount' ? 'keyEvents' : key;
}

function labelFor(ds: Dataset, raw: string): string {
  if (ds.key === 'behaviour.hours') return fmtHour(raw);
  if (ds.key === 'behaviour.weekdays') return fmtDow(Number(raw));
  if (ds.key === 'realtime.minutes') return `${raw}m`;
  if (ds.key === 'audience.userType') return raw === 'new' ? 'New' : raw === 'returning' ? 'Returning' : raw;
  return raw || '(not set)';
}

function liveFilters(config: WidgetConfig): Filter[] {
  return (config.filters ?? []).filter((f) => f.value);
}

/**
 * Exact unique visitors over a window from GA (rollups hold daily uniques,
 * whose sum over-counts anyone who came back). Cached 10 minutes. Falls
 * back to the daily sum when the site has no property or GA is unreachable.
 * A segment becomes a GA dimension filter, so the tile stays exact under it.
 */
async function exactUsers(site: Site, metric: 'users' | 'newUsers', from: string, to: string, fallback: number, seg: Segment | null): Promise<number> {
  if (!site.ga_property_id) return fallback;
  const filter = seg ? gaFilterFor(seg) : null;
  if (seg && !filter) return fallback;
  const key = `uniques:${site.ga_property_id}:${metric}:${from}:${to}${seg ? `:${segmentParam(seg)}` : ''}`;
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
      filters: filter ? [filter] : undefined,
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

/** Days of a series, zero-filled: every day, or every hour of a day or two (today up to now). */
export function fillDays(points: Point[], from: string, to: string, bucket: Bucket, lastHour = 23): Point[] {
  if (bucket !== 'day' && bucket !== 'hour') return points;
  const byName = new Map(points.map((p) => [p.name, p]));
  const names = bucket === 'hour' ? eachHour(from, to, lastHour) : eachDay(from, to);
  return names.map((d) => byName.get(d) ?? { name: d, value: 0 });
}

/**
 * The scope a KPI or trend sums: under a segment, an unfiltered widget reads
 * the segment's own family (exact); a widget with its own filters or a fixed
 * condition resolves like a ranked one. Without a segment, the dataset as is.
 */
function totalsScope(ds: Dataset, config: WidgetConfig, seg: Segment | null): Scope | { reason: string } {
  if (seg && liveFilters(config).length === 0 && !ds.where) return segmentScope(seg);
  const r = scopeFor(ds, seg, liveFilters(config));
  return r.ok ? r.scope : { reason: r.reason };
}

/**
 * Whether a trend charts by the hour: site-wide totals over a day or two,
 * unfiltered (the `hour` family stores only the site as a whole).
 */
function hourly(ds: Dataset, config: WidgetConfig, range: DateRange, seg: Segment | null): boolean {
  if (ds.report !== 'totals' || seg || liveFilters(config).length > 0) return false;
  return config.bucket === 'hour' || (!config.bucket && isHourly(range));
}

async function series(site: Site, scope: Scope, from: string, to: string, bucket: Bucket, byHour: boolean, metric: MetricKey, lastHour: number): Promise<Point[]> {
  const stmt = byHour ? hourlySql(site.id, from, to) : timeseriesSql(site.id, scope, from, to, bucket);
  const rows = await many<{ name: string } & Record<string, number>>(stmt);
  return fillDays(
    rows.map((r) => ({ name: r.name, value: metricValue(metric, r as Sums) })),
    from,
    to,
    byHour ? 'hour' : bucket,
    lastHour,
  );
}

async function kpi(site: Site, ds: Dataset, config: WidgetConfig, range: DateRange, seg: Segment | null): Promise<WidgetData> {
  const scope = totalsScope(ds, config, seg);
  if ('reason' in scope) return { kind: 'empty', reason: scope.reason };
  const metric = metricOf(config, ds, scope);
  const cur = await one(totalsSql(site.id, scope, range.from, range.to));
  let value = metricValue(metric, cur);
  let previous: number | null = null;
  const prevRange = comparisonPeriod(range);
  if (config.compare !== false) {
    const prev = await one(totalsSql(site.id, scope, prevRange.from, prevRange.to));
    previous = metricValue(metric, prev);
  }
  // Exact uniques only make sense site-wide (a segment narrows them through GA's own filter).
  if (ds.key === 'overview.totals' && (metric === 'users' || metric === 'newUsers') && liveFilters(config).length === 0) {
    value = await exactUsers(site, metric, range.from, range.to, value, seg);
    if (previous !== null) previous = await exactUsers(site, metric, prevRange.from, prevRange.to, previous, seg);
  }
  // Sparkline: daily values across the range (hourly for a day or two of site-wide totals).
  const byHour = hourly(ds, config, range, seg);
  const spark = await series(site, scope, range.from, range.to, autoBucket(range), byHour, metric, lastHourOf(site, range));
  return { kind: 'kpi', value, previous, spark: spark.map((p) => p.value) };
}

/** The last hour to zero-fill when the range ends today: now, in the site's zone. */
function lastHourOf(site: Site, range: { to: string }): number {
  return range.to >= todayInZone(site.timezone) ? hourInZone(site.timezone) : 23;
}

async function timeseries(site: Site, ds: Dataset, config: WidgetConfig, range: DateRange, seg: Segment | null): Promise<WidgetData> {
  const scope = totalsScope(ds, config, seg);
  if ('reason' in scope) return { kind: 'empty', reason: scope.reason };
  const metric = metricOf(config, ds, scope);
  const byHour = hourly(ds, config, range, seg);
  const bucket: Bucket = byHour ? 'hour' : config.bucket && config.bucket !== 'hour' ? config.bucket : autoBucket(range);
  let points = await series(site, scope, range.from, range.to, bucket, byHour, metric, lastHourOf(site, range));
  if (config.compare) {
    const prev = comparisonPeriod(range);
    const pvals = await series(site, scope, prev.from, prev.to, bucket, byHour, metric, 23);
    // Align by position: bucket i of this period against bucket i of the other.
    points = points.map((p, i) => ({ ...p, previous: pvals[i]?.value ?? 0 }));
  }
  return { kind: 'timeseries', bucket, points, from: range.from, to: range.to };
}

/** Rows of a ranked/table query, with the scope they came from. */
async function rankedRows(
  site: Site,
  ds: Dataset,
  scope: Scope,
  range: DateRange,
  opts: { sortMetric: MetricKey; dir: 'asc' | 'desc'; limit: number },
): Promise<Row[]> {
  if (ds.key === 'behaviour.weekdays') return many<Row>(weekdaySql(site.id, scope, range.from, range.to));
  if (isOrdinal(ds)) {
    // Hours: every bucket in natural order, not top-N.
    const rows = await many<Row>(rankedSql(site.id, scope, range.from, range.to, { sortMetric: opts.sortMetric, dir: 'asc', limit: 200 }));
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return rows;
  }
  return many<Row>(rankedSql(site.id, scope, range.from, range.to, opts));
}

async function ranked(site: Site, ds: Dataset, config: WidgetConfig, range: DateRange, seg: Segment | null, defaultLimit: number): Promise<WidgetData> {
  const r = scopeFor(ds, seg, liveFilters(config));
  if (!r.ok) return { kind: 'empty', reason: r.reason };
  const scope = r.scope;
  const metric = metricOf(config, ds, scope);
  const sortMetric = isMetricKey(config.sort?.metric) && ds.metrics.includes(config.sort!.metric as MetricKey) ? metricOf({ metric: config.sort!.metric }, ds, scope) : metric;
  const dir = config.sort?.dir ?? 'desc';
  const limit = Math.min(500, Math.max(1, config.limit ?? defaultLimit));
  const rows = await rankedRows(site, ds, scope, range, { sortMetric, dir, limit });
  const denominator = totalsScope(ds, config, seg);
  const totals = await one(totalsSql(site.id, 'reason' in denominator ? scope : denominator, range.from, range.to));
  const total = metricValue(metric, totals);
  const out = rows.map((r) => {
    const value = metricValue(metric, r as Sums);
    return {
      key: labelFor(ds, String(r.name)),
      raw: String(r.name),
      sub: scope.sub && r.sub !== undefined ? String(r.sub) : undefined,
      value,
      share: total > 0 && METRIC_BY_KEY[metric].kind === 'sum' ? value / total : 0,
    };
  });
  return { kind: 'ranked', rows: out, total };
}

async function table(site: Site, ds: Dataset, config: WidgetConfig, range: DateRange, seg: Segment | null): Promise<WidgetData> {
  const cols = (config.metrics ?? []).filter((m): m is MetricKey => isMetricKey(m) && ds.metrics.includes(m));
  const dir = config.sort?.dir ?? 'desc';
  const limit = Math.min(500, Math.max(1, config.limit ?? 25));
  let rows: Row[];
  let scope: Scope;
  if (ds.dim === 'none' && ds.key !== 'behaviour.weekdays') {
    // Totals as a table = one row per bucket.
    const t = totalsScope(ds, config, seg);
    if ('reason' in t) return { kind: 'empty', reason: t.reason };
    scope = t;
    const byHour = hourly(ds, config, range, seg);
    const bucket: Bucket = byHour ? 'hour' : config.bucket && config.bucket !== 'hour' ? config.bucket : autoBucket(range);
    rows = await many<Row>(byHour ? hourlySql(site.id, range.from, range.to) : timeseriesSql(site.id, scope, range.from, range.to, bucket));
    if (dir === 'desc') rows.reverse();
  } else {
    const r = scopeFor(ds, seg, liveFilters(config));
    if (!r.ok) return { kind: 'empty', reason: r.reason };
    scope = r.scope;
    const primary = metricOf(config, ds, scope);
    const metrics = cols.length ? cols : [primary, ...ds.metrics.filter((m) => m !== primary).slice(0, 3)];
    const sortMetric = isMetricKey(config.sort?.metric) && metrics.includes(config.sort!.metric as MetricKey) ? (config.sort!.metric as MetricKey) : metrics[0];
    rows = await rankedRows(site, ds, scope, range, { sortMetric: metricOf({ metric: sortMetric }, ds, scope), dir, limit });
  }
  const primary = metricOf(config, ds, scope);
  const metrics: MetricKey[] = cols.length ? cols : [primary, ...ds.metrics.filter((m) => m !== primary).slice(0, 3)];
  return {
    kind: 'table',
    columns: [{ key: 'name', label: ds.dimLabel, metric: false }, ...metrics.map((m) => ({ key: m, label: METRIC_BY_KEY[m].short, metric: true }))],
    rows: rows.map((r) => {
      const out: Record<string, string | number> = { name: labelFor(ds, String(r.name)), raw: String(r.name) };
      if (scope.sub && r.sub !== undefined) out.sub = String(r.sub);
      for (const m of metrics) out[m] = metricValue(scope.eventCountAsKeyEvents && m === 'eventCount' ? 'keyEvents' : m, r as Sums);
      return out;
    }),
  };
}

/** The entry point every widget goes through. */
export async function runWidgetQuery(site: Site, type: ChartType, config: WidgetConfig, range: DateRange, seg: Segment | null = null): Promise<WidgetData> {
  if (type === 'note') return { kind: 'empty' };
  const ds = config.dataset ? DATASET_BY_KEY[config.dataset] : undefined;
  if (!ds) return { kind: 'empty', reason: 'Choose what to show' };
  if (ds.live) return runRealtime(site, ds, type, config);

  switch (type) {
    case 'kpi':
      return kpi(site, ds, config, range, seg);
    case 'line':
      return isOrdinal(ds) ? ranked(site, ds, config, range, seg, 200) : timeseries(site, ds, config, range, seg);
    case 'column':
    case 'bar':
      return ds.dim === 'none' && ds.key !== 'behaviour.weekdays' ? timeseries(site, ds, config, range, seg) : ranked(site, ds, config, range, seg, type === 'bar' ? 10 : 12);
    case 'donut':
      return ranked(site, ds, config, range, seg, 6);
    case 'list':
      return ranked(site, ds, config, range, seg, 10);
    case 'table':
      return table(site, ds, config, range, seg);
    default:
      return { kind: 'empty' };
  }
}

/** Column keys a metric needs, for callers that want to project rows themselves. */
export const COLUMNS = METRIC_COLUMNS;
