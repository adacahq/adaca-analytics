/**
 * SQL builders for the query engine — pure, unit-tested. Every builder
 * returns a parameterised statement; the only interpolated pieces are
 * identifiers and expressions from our own registries.
 */
import type { Bucket, Filter, SortDir } from '@/lib/dashboard/types';
import type { Dataset } from './catalog';
import { metricSql, type MetricKey } from './metrics';
import { METRIC_COLUMNS } from './reports';

export interface Stmt {
  sql: string;
  params: (string | number)[];
}

const SUMS = METRIC_COLUMNS.map((c) => `SUM(${c}) AS ${c}`).join(', ');

function filterClauses(ds: Dataset, filters: Filter[] | undefined, params: (string | number)[]): string {
  const parts: string[] = [];
  if (ds.where) {
    parts.push(`${ds.where.dim} = ?`);
    params.push(ds.where.value);
  }
  for (const f of filters ?? []) {
    if (!f.value) continue;
    const col = f.dim === 'key2' ? 'key2' : 'key1';
    switch (f.op) {
      case 'eq':
        parts.push(`${col} = ?`);
        params.push(f.value);
        break;
      case 'neq':
        parts.push(`${col} <> ?`);
        params.push(f.value);
        break;
      case 'contains':
        parts.push(`${col} LIKE ? ESCAPE '\\'`);
        params.push(`%${escapeLike(f.value)}%`);
        break;
      case 'not_contains':
        parts.push(`${col} NOT LIKE ? ESCAPE '\\'`);
        params.push(`%${escapeLike(f.value)}%`);
        break;
    }
  }
  return parts.length ? ` AND ${parts.join(' AND ')}` : '';
}

function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Summed columns for the whole window (KPI totals, table totals, ranked denominators). */
export function totalsSql(siteId: string, ds: Dataset, from: string, to: string, filters?: Filter[]): Stmt {
  const params: (string | number)[] = [siteId, ds.report, from, to];
  const where = filterClauses(ds, filters, params);
  return { sql: `SELECT ${SUMS} FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ?${where}`, params };
}

/** The bucket expression for a date column. */
export function bucketExpr(bucket: Bucket): string {
  switch (bucket) {
    case 'day':
      return 'date';
    case 'week':
      // Monday-start: shift so Monday is day 0, then subtract.
      return "date(date, '-' || ((strftime('%w', date) + 6) % 7) || ' days')";
    case 'month':
      return "substr(date, 1, 7)";
  }
}

/** Metric per time bucket. */
export function timeseriesSql(siteId: string, ds: Dataset, from: string, to: string, bucket: Bucket, filters?: Filter[]): Stmt {
  const params: (string | number)[] = [siteId, ds.report, from, to];
  const where = filterClauses(ds, filters, params);
  return {
    sql: `SELECT ${bucketExpr(bucket)} AS name, ${SUMS} FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ?${where} GROUP BY 1 ORDER BY 1`,
    params,
  };
}

/** Metric per dimension value, sorted, limited. Sub-dimension rides along when the dataset has one. */
export function rankedSql(
  siteId: string,
  ds: Dataset,
  from: string,
  to: string,
  opts: { sortMetric: MetricKey; dir: SortDir; limit: number; filters?: Filter[] },
): Stmt {
  const dim = ds.dim === 'key2' ? 'key2' : 'key1';
  const sub = ds.subDim ? ', key2' : '';
  const params: (string | number)[] = [siteId, ds.report, from, to];
  const where = filterClauses(ds, opts.filters, params);
  params.push(opts.limit);
  return {
    sql: `SELECT ${dim} AS name${sub ? ', key2 AS sub' : ''}, ${SUMS} FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ?${where} GROUP BY ${dim}${sub} ORDER BY ${metricSql(opts.sortMetric)} ${opts.dir === 'asc' ? 'ASC' : 'DESC'}, name LIMIT ?`,
    params,
  };
}

/** Weekday breakdown from the daily totals (0 = Sunday, GA's convention). */
export function weekdaySql(siteId: string, ds: Dataset, from: string, to: string, filters?: Filter[]): Stmt {
  const params: (string | number)[] = [siteId, ds.report, from, to];
  const where = filterClauses(ds, filters, params);
  return {
    sql: `SELECT strftime('%w', date) AS name, ${SUMS} FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ?${where} GROUP BY 1 ORDER BY 1`,
    params,
  };
}

/** Distinct values of a dimension (for the builder's filter pickers). */
export function dimensionValuesSql(siteId: string, ds: Dataset, dim: 'key1' | 'key2', from: string, to: string, limit = 200): Stmt {
  return {
    sql: `SELECT ${dim} AS name, SUM(sessions) + SUM(pageviews) AS weight FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ? GROUP BY 1 ORDER BY weight DESC LIMIT ?`,
    params: [siteId, ds.report, from, to, limit],
  };
}
