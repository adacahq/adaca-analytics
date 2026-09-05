/**
 * The metric registry — what a widget can measure. Stored columns are summed
 * over the range; derived metrics are computed from the sums (never averaged
 * per day, which would weight quiet days like busy ones).
 */
import { fmtCompact, fmtDuration, fmtInt, fmtPercent, fmtRatio } from '@/lib/format';
import type { MetricColumn } from './reports';

export type MetricKey =
  | 'users'
  | 'newUsers'
  | 'sessions'
  | 'engagedSessions'
  | 'pageviews'
  | 'engagementRate'
  | 'bounceRate'
  | 'avgEngagementTime'
  | 'viewsPerSession'
  | 'keyEvents'
  | 'keyEventRate'
  | 'eventCount';

export interface MetricDef {
  key: MetricKey;
  label: string;
  /** Short label for tight spaces (table headers, KPI captions). */
  short: string;
  /** How the value is derived from the summed columns. */
  kind: 'sum' | 'ratio';
  column?: MetricColumn;
  /** For ratios: numerator / denominator columns. */
  num?: MetricColumn;
  den?: MetricColumn;
  /** Format for display; `compact` is for KPI tiles. */
  format: (v: number, compact?: boolean) => string;
  /** Is a higher value good? Drives the delta tone. null = neutral. */
  goodDirection: 'up' | 'down' | null;
}

const number = (v: number, compact?: boolean) => (compact ? fmtCompact(v) : fmtInt(v));

export const METRICS: MetricDef[] = [
  { key: 'users', label: 'Visitors', short: 'Visitors', kind: 'sum', column: 'users', format: number, goodDirection: 'up' },
  { key: 'newUsers', label: 'New visitors', short: 'New', kind: 'sum', column: 'new_users', format: number, goodDirection: 'up' },
  { key: 'sessions', label: 'Visits', short: 'Visits', kind: 'sum', column: 'sessions', format: number, goodDirection: 'up' },
  { key: 'engagedSessions', label: 'Engaged visits', short: 'Engaged', kind: 'sum', column: 'engaged_sessions', format: number, goodDirection: 'up' },
  { key: 'pageviews', label: 'Pageviews', short: 'Views', kind: 'sum', column: 'pageviews', format: number, goodDirection: 'up' },
  { key: 'engagementRate', label: 'Engagement rate', short: 'Eng. rate', kind: 'ratio', num: 'engaged_sessions', den: 'sessions', format: (v) => fmtPercent(v), goodDirection: 'up' },
  { key: 'bounceRate', label: 'Bounce rate', short: 'Bounce', kind: 'ratio', num: 'engaged_sessions', den: 'sessions', format: (v) => fmtPercent(v), goodDirection: 'down' },
  { key: 'avgEngagementTime', label: 'Avg engagement time', short: 'Avg time', kind: 'ratio', num: 'engagement_seconds', den: 'sessions', format: (v) => fmtDuration(v), goodDirection: 'up' },
  { key: 'viewsPerSession', label: 'Views per visit', short: 'Views/visit', kind: 'ratio', num: 'pageviews', den: 'sessions', format: (v) => fmtRatio(v), goodDirection: 'up' },
  { key: 'keyEvents', label: 'Key events', short: 'Key events', kind: 'sum', column: 'key_events', format: number, goodDirection: 'up' },
  { key: 'keyEventRate', label: 'Key event rate', short: 'KE rate', kind: 'ratio', num: 'key_events', den: 'sessions', format: (v) => fmtPercent(v), goodDirection: 'up' },
  { key: 'eventCount', label: 'Events', short: 'Events', kind: 'sum', column: 'event_count', format: number, goodDirection: null },
];

export const METRIC_BY_KEY: Record<MetricKey, MetricDef> = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, MetricDef>;

export function isMetricKey(k: unknown): k is MetricKey {
  return typeof k === 'string' && k in METRIC_BY_KEY;
}

/** Compute a metric from a row of summed columns. Bounce = 1 − engagement. */
export function metricValue(key: MetricKey, sums: Partial<Record<MetricColumn, number>>): number {
  const m = METRIC_BY_KEY[key];
  if (m.kind === 'sum') return sums[m.column!] ?? 0;
  const den = sums[m.den!] ?? 0;
  if (den === 0) return 0;
  const ratio = (sums[m.num!] ?? 0) / den;
  return key === 'bounceRate' ? 1 - ratio : ratio;
}

/** The SQL expression that computes a metric from aggregated columns. */
export function metricSql(key: MetricKey, alias = ''): string {
  const m = METRIC_BY_KEY[key];
  const col = (c: string) => (alias ? `${alias}.${c}` : c);
  if (m.kind === 'sum') return `SUM(${col(m.column!)})`;
  const ratio = `CASE WHEN SUM(${col(m.den!)}) = 0 THEN 0 ELSE CAST(SUM(${col(m.num!)}) AS REAL) / SUM(${col(m.den!)}) END`;
  return key === 'bounceRate' ? `(1 - ${ratio})` : ratio;
}
