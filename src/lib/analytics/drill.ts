/**
 * Everything one entity page needs, in one D1 round trip: the entity's KPIs
 * with deltas, its share of the site, its trend with the previous period, and
 * every breakdown from the precomputed pair families. No live Google calls.
 */
import { db } from '@/lib/db/client';
import type { Site } from '@/lib/db/sites';
import type { Bucket, Point } from '@/lib/dashboard/types';
import { ENTITY_BY_KIND, type Breakdown, type EntityDef, type EntityKind } from './entities';
import { metricValue, type MetricKey } from './metrics';
import { REPORT_BY_KEY, type MetricColumn } from './reports';
import { autoBucket, comparisonPeriod, type DateRange } from './ranges';
import { breakdownSql, entitySeriesSql, entityTotalsSql, siteTotalsSql, type Stmt } from './query-sql';
import { fillDays } from './query';

type Sums = Partial<Record<MetricColumn, number>>;

export interface EntityKpi {
  metric: MetricKey;
  value: number;
  previous: number | null;
}

export interface BreakdownData {
  label: string;
  dimLabel: string;
  linkTo: EntityKind | null;
  metric: MetricKey;
  /** Whether the family behind it is a pair family (drill-down data) rather than a single one. */
  fromPairs: boolean;
  rows: { key: string; value: number; share: number }[];
  total: number;
}

export interface EntityPageData {
  kind: EntityKind;
  value: string;
  /** Any rows for the value in the period. */
  found: boolean;
  lead: MetricKey;
  /** Entity ÷ site on the lead metric, or null when the site total is zero. */
  share: number | null;
  kpis: EntityKpi[];
  trend: { bucket: Bucket; points: Point[]; compare: boolean };
  breakdowns: BreakdownData[];
  /** Pair-backed breakdowns exist but every one is empty — the site probably has no drill-down data yet. */
  pairsMissing: boolean;
}

export const BREAKDOWN_LIMIT = 10;

function prepared(stmt: Stmt) {
  return db().prepare(stmt.sql).bind(...stmt.params);
}

export async function loadEntity(site: Site, kind: EntityKind, value: string, range: DateRange): Promise<EntityPageData> {
  const def: EntityDef = ENTITY_BY_KIND[kind];
  const prev = comparisonPeriod(range);
  const bucket = autoBucket(range);
  const compare = range.compare !== null;

  const stmts: Stmt[] = [
    entityTotalsSql(site.id, def, value, range.from, range.to),
    entityTotalsSql(site.id, def, value, prev.from, prev.to),
    siteTotalsSql(site.id, range.from, range.to),
    entitySeriesSql(site.id, def, value, range.from, range.to, bucket),
    entitySeriesSql(site.id, def, value, prev.from, prev.to, bucket),
    ...def.breakdowns.map((b) => breakdownSql(site.id, b, value, range.from, range.to, { metric: b.metric, limit: BREAKDOWN_LIMIT })),
  ];
  const results = await db().batch<Record<string, number>>(stmts.map(prepared));
  const row = (i: number): Sums => (results[i]?.results?.[0] ?? {}) as Sums;
  const rows = (i: number): ({ name: string } & Sums)[] => (results[i]?.results ?? []) as unknown as ({ name: string } & Sums)[];

  const cur = row(0);
  const before = row(1);
  const siteCur = row(2);
  const leadNow = metricValue(def.lead, cur);
  const leadSite = metricValue(def.lead, siteCur);

  // Deltas are always shown (against the page's comparison window, else the period before): one more precomputed read.
  const kpis: EntityKpi[] = def.kpis.map((m) => ({ metric: m, value: metricValue(m, cur), previous: metricValue(m, before) }));

  const points = fillDays(
    rows(3).map((r) => ({ name: r.name, value: metricValue(def.lead, r) })),
    range.from,
    range.to,
    bucket,
  );
  if (compare) {
    const pvals = fillDays(
      rows(4).map((r) => ({ name: r.name, value: metricValue(def.lead, r) })),
      prev.from,
      prev.to,
      bucket,
    );
    points.forEach((p, i) => {
      p.previous = pvals[i]?.value ?? 0;
    });
  }

  const breakdowns: BreakdownData[] = def.breakdowns.map((b: Breakdown, i) => {
    const total = metricValue(b.metric, cur);
    const list = rows(5 + i).map((r) => {
      const v = metricValue(b.metric, r);
      return { key: r.name, value: v, share: total > 0 ? v / total : 0 };
    });
    return { label: b.label, dimLabel: b.dimLabel, linkTo: b.linkTo, metric: b.metric, fromPairs: REPORT_BY_KEY[b.family].pair, rows: list, total };
  });

  const pairBacked = breakdowns.filter((b) => b.fromPairs);
  const found = Object.values(cur).some((v) => typeof v === 'number' && v > 0);
  return {
    kind,
    value,
    found,
    lead: def.lead,
    share: leadSite > 0 ? leadNow / leadSite : null,
    kpis,
    trend: { bucket, points, compare },
    breakdowns,
    pairsMissing: found && pairBacked.length > 0 && pairBacked.every((b) => b.rows.length === 0),
  };
}
