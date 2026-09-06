/**
 * SQL builders for the query engine — pure, unit-tested. Every builder
 * returns a parameterised statement; the only interpolated pieces are
 * identifiers and expressions from our own registries.
 *
 * Widget builders read a `Scope` (segments.ts): the family to read, the key
 * or expression that is the shown dimension, and every condition that
 * narrows it — the dataset's fixed condition, the widget's filters and the
 * dashboard-wide segment.
 */
import type { Bucket, Filter, SortDir } from '@/lib/dashboard/types';
import type { Dataset } from './catalog';
import { splitSourceMedium, type KeySide, type Match } from './entities';
import { metricSql, type MetricKey } from './metrics';
import { METRIC_COLUMNS, OTHER, REPORT_BY_KEY } from './reports';
import type { Scope, SegmentClause } from './segments';

export interface Stmt {
  sql: string;
  params: (string | number)[];
}

const SUMS = METRIC_COLUMNS.map((c) => `SUM(${c}) AS ${c}`).join(', ');

function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** One filter condition on a column or expression. */
function opClause(expr: string, op: Filter['op'], value: string, params: (string | number)[]): string {
  switch (op) {
    case 'eq':
      params.push(value);
      return `${expr} = ?`;
    case 'neq':
      params.push(value);
      return `${expr} <> ?`;
    case 'contains':
      params.push(`%${escapeLike(value)}%`);
      return `${expr} LIKE ? ESCAPE '\\'`;
    case 'not_contains':
      params.push(`%${escapeLike(value)}%`);
      return `${expr} NOT LIKE ? ESCAPE '\\'`;
  }
}

/** The expression a segment condition applies to: the key, or the part of "source / medium" it names. */
function matchExpr(side: KeySide, match: Match): string {
  switch (match) {
    case 'eq':
      return side;
    case 'source':
      return `CASE WHEN instr(${side}, ' / ') > 0 THEN substr(${side}, 1, instr(${side}, ' / ') - 1) ELSE ${side} END`;
    case 'medium':
      return `CASE WHEN instr(${side}, ' / ') > 0 THEN substr(${side}, instr(${side}, ' / ') + 3) ELSE '(none)' END`;
    case 'sourceMedium':
      return "(key1 || ' / ' || key2)";
  }
}

/** The segment's condition on a family. Exact matches keep the plain `key = ?` shape so the indexes serve them. */
export function segmentClause(s: SegmentClause, params: (string | number)[]): string {
  if (s.match === 'sourceMedium' && s.op === 'eq') {
    const [src, med] = splitSourceMedium(s.value);
    if (med === null) {
      params.push(src);
      return 'key1 = ?';
    }
    params.push(src, med);
    return 'key1 = ? AND key2 = ?';
  }
  return opClause(matchExpr(s.side, s.match), s.op, s.value, params);
}

/** Every condition of a scope after `site_id = ? AND report = ? AND date >= ? AND date <= ?`. */
function scopeClauses(siteId: string, scope: Scope, from: string, to: string, params: (string | number)[]): string {
  const parts: string[] = [];
  if (scope.where) {
    parts.push(`${scope.where.dim} = ?`);
    params.push(scope.where.value);
  }
  for (const f of scope.filters) {
    if (!f.value) continue;
    parts.push(opClause(f.dim === 'key2' ? 'key2' : 'key1', f.op, f.value, params));
  }
  if (scope.segment) parts.push(segmentClause(scope.segment, params));
  if (scope.keyEventsOn) {
    parts.push(`${scope.keyEventsOn} IN (SELECT key1 FROM rollups WHERE site_id = ? AND report = 'event' AND key2 = '1' AND date >= ? AND date <= ?)`);
    params.push(siteId, from, to);
  }
  // A pair family's per-day fold is not a value of the dimension.
  if (scope.segment && scope.dim !== 'none' && REPORT_BY_KEY[scope.report].pair) {
    parts.push(`${scope.dim} <> ?`);
    params.push(OTHER);
  }
  return parts.length ? ` AND ${parts.join(' AND ')}` : '';
}

function head(siteId: string, scope: Scope, from: string, to: string): { where: string; params: (string | number)[] } {
  const params: (string | number)[] = [siteId, scope.report, from, to];
  const where = `site_id = ? AND report = ? AND date >= ? AND date <= ?${scopeClauses(siteId, scope, from, to, params)}`;
  return { where, params };
}

/** Summed columns for the whole window (KPI totals, table totals, ranked denominators). */
export function totalsSql(siteId: string, scope: Scope, from: string, to: string): Stmt {
  const h = head(siteId, scope, from, to);
  return { sql: `SELECT ${SUMS} FROM rollups WHERE ${h.where}`, params: h.params };
}

/** The bucket expression for a date column. */
export function bucketExpr(bucket: Bucket): string {
  switch (bucket) {
    case 'hour': // only the `hour` family has hours; see hourlySql
    case 'day':
      return 'date';
    case 'week':
      // Monday-start: shift so Monday is day 0, then subtract.
      return "date(date, '-' || ((strftime('%w', date) + 6) % 7) || ' days')";
    case 'month':
      return 'substr(date, 1, 7)';
  }
}

/** Metric per time bucket. */
export function timeseriesSql(siteId: string, scope: Scope, from: string, to: string, bucket: Bucket): Stmt {
  const h = head(siteId, scope, from, to);
  return { sql: `SELECT ${bucketExpr(bucket)} AS name, ${SUMS} FROM rollups WHERE ${h.where} GROUP BY 1 ORDER BY 1`, params: h.params };
}

/**
 * Site-wide metrics per hour, from the `hour` family (one row per day per
 * hour, so a day or two of it is an hourly series). Bucket names are
 * 'YYYY-MM-DDTHH'.
 */
export function hourlySql(siteId: string, from: string, to: string): Stmt {
  return {
    sql: `SELECT date || 'T' || key1 AS name, ${SUMS} FROM rollups WHERE site_id = ? AND report = 'hour' AND date >= ? AND date <= ? GROUP BY 1 ORDER BY 1`,
    params: [siteId, from, to],
  };
}

/** Metric per dimension value, sorted, limited. Sub-dimension rides along when the scope has one. */
export function rankedSql(siteId: string, scope: Scope, from: string, to: string, opts: { sortMetric: MetricKey; dir: SortDir; limit: number }): Stmt {
  const dim = scope.dimExpr || 'key1';
  const sub = scope.sub ? `, ${scope.sub} AS sub` : '';
  const h = head(siteId, scope, from, to);
  h.params.push(opts.limit);
  return {
    sql: `SELECT ${dim} AS name${sub}, ${SUMS} FROM rollups WHERE ${h.where} GROUP BY ${dim}${scope.sub ? `, ${scope.sub}` : ''} ORDER BY ${metricSql(opts.sortMetric)} ${opts.dir === 'asc' ? 'ASC' : 'DESC'}, name LIMIT ?`,
    params: h.params,
  };
}

/** Weekday breakdown from the daily totals (0 = Sunday, GA's convention). */
export function weekdaySql(siteId: string, scope: Scope, from: string, to: string): Stmt {
  const h = head(siteId, scope, from, to);
  return { sql: `SELECT strftime('%w', date) AS name, ${SUMS} FROM rollups WHERE ${h.where} GROUP BY 1 ORDER BY 1`, params: h.params };
}

/** Distinct values of a dimension (for the builder's filter pickers), busiest first. */
export function dimensionValuesSql(siteId: string, ds: Dataset, dim: 'key1' | 'key2', from: string, to: string, limit = 200): Stmt {
  return {
    sql: `SELECT ${dim} AS name, SUM(sessions) + SUM(pageviews) AS weight FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ? GROUP BY 1 ORDER BY weight DESC LIMIT ?`,
    params: [siteId, ds.report, from, to, limit],
  };
}

/** Distinct values of one key of a family (segment value suggestions), busiest first. */
export function familyValuesSql(siteId: string, report: string, expr: string, from: string, to: string, limit = 200): Stmt {
  return {
    sql: `SELECT ${expr} AS name, SUM(sessions) + SUM(pageviews) AS weight FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ? AND ${expr} <> ? GROUP BY 1 ORDER BY weight DESC LIMIT ?`,
    params: [siteId, report, from, to, OTHER, limit],
  };
}

/* ── Drill-down ──────────────────────────────────────────────────── */

/** WHERE fragment matching an entity's value on one side of a family. */
function matchClause(side: KeySide, match: Match, value: string, params: (string | number)[]): string {
  switch (match) {
    case 'eq':
      params.push(value);
      return `${side} = ?`;
    case 'source':
      params.push(`${escapeLike(value)} / %`);
      return `${side} LIKE ? ESCAPE '\\'`;
    case 'medium':
      params.push(`% / ${escapeLike(value)}`);
      return `${side} LIKE ? ESCAPE '\\'`;
    case 'sourceMedium': {
      const [src, med] = splitSourceMedium(value);
      if (med === null) {
        params.push(src);
        return 'key1 = ?';
      }
      params.push(src, med);
      return 'key1 = ? AND key2 = ?';
    }
  }
}

export interface EntityMatch {
  family: string;
  side: KeySide;
  match: Match;
}

/** An entity's own summed columns over a window. */
export function entityTotalsSql(siteId: string, e: EntityMatch, value: string, from: string, to: string): Stmt {
  const params: (string | number)[] = [siteId, e.family, from, to];
  const where = matchClause(e.side, e.match, value, params);
  return { sql: `SELECT ${SUMS} FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ? AND ${where}`, params };
}

/** An entity's summed columns per time bucket. */
export function entitySeriesSql(siteId: string, e: EntityMatch, value: string, from: string, to: string, bucket: Bucket): Stmt {
  const params: (string | number)[] = [siteId, e.family, from, to];
  const where = matchClause(e.side, e.match, value, params);
  return {
    sql: `SELECT ${bucketExpr(bucket)} AS name, ${SUMS} FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ? AND ${where} GROUP BY 1 ORDER BY 1`,
    params,
  };
}

/** The site-wide summed columns (the denominator of "share of site"). */
export function siteTotalsSql(siteId: string, from: string, to: string): Stmt {
  return { sql: `SELECT ${SUMS} FROM rollups WHERE site_id = ? AND report = 'totals' AND date >= ? AND date <= ?`, params: [siteId, from, to] };
}

/**
 * Rank the other side of a family for one entity value: "landing pages for
 * google / organic" (side key1 → rank key2) or "sources for /pricing"
 * (side key2 → rank key1). The per-day `(other)` fold is excluded from the
 * ranking; shares are taken against the entity's own totals, so they stay exact.
 */
export function breakdownSql(siteId: string, b: EntityMatch, value: string, from: string, to: string, opts: { metric: MetricKey; limit: number }): Stmt {
  const other: KeySide = b.side === 'key1' ? 'key2' : 'key1';
  const params: (string | number)[] = [siteId, b.family, from, to];
  const where = matchClause(b.side, b.match, value, params);
  params.push(OTHER, opts.limit);
  return {
    sql: `SELECT ${other} AS name, ${SUMS} FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ? AND ${where} AND ${other} <> ? GROUP BY ${other} ORDER BY ${metricSql(opts.metric)} DESC, name LIMIT ?`,
    params,
  };
}
