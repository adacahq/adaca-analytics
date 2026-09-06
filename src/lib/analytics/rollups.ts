import { db } from '@/lib/db/client';
import { lit, num } from '@/lib/db/sql';
import { METRIC_COLUMNS, PAIRS, type ReportKey, type RollupRow } from './reports';

/** Rows per INSERT statement: ~100 bytes a row keeps a statement well under D1's 100 KB. */
const ROWS_PER_STATEMENT = 400;
/** Statements per db.batch() call (D1 counts each statement against the per-invocation query cap). */
const STATEMENTS_PER_BATCH = 50;

const COLS = `site_id, report, date, key1, key2, ${METRIC_COLUMNS.join(', ')}`;

function valuesTuple(siteId: string, report: ReportKey, r: RollupRow): string {
  const mets = METRIC_COLUMNS.map((_, i) => num(r.metrics[i] ?? 0));
  return `(${lit(siteId)}, ${lit(report)}, ${lit(r.date)}, ${lit(r.key1)}, ${lit(r.key2)}, ${mets.join(', ')})`;
}

/** Build the INSERT OR REPLACE statements for a set of rows (pure; exported for tests). */
export function insertStatements(siteId: string, report: ReportKey, rows: RollupRow[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
    const chunk = rows.slice(i, i + ROWS_PER_STATEMENT);
    out.push(`INSERT OR REPLACE INTO rollups (${COLS}) VALUES\n${chunk.map((r) => valuesTuple(siteId, report, r)).join(',\n')}`);
  }
  return out;
}

/** Clear a family's rows for a date window (before re-ingesting it). */
export async function clearRollups(siteId: string, report: ReportKey, from: string, to: string): Promise<void> {
  await db()
    .prepare('DELETE FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ?')
    .bind(siteId, report, from, to)
    .run();
}

/** Upsert rows in bounded batches. Returns the row count written. */
export async function writeRollups(siteId: string, report: ReportKey, rows: RollupRow[]): Promise<number> {
  if (!rows.length) return 0;
  const stmts = insertStatements(siteId, report, rows);
  for (let i = 0; i < stmts.length; i += STATEMENTS_PER_BATCH) {
    const slice = stmts.slice(i, i + STATEMENTS_PER_BATCH).map((s) => db().prepare(s));
    await db().batch(slice);
  }
  return rows.length;
}

/** How much history a site holds, for the Settings page. */
export async function rollupSpan(siteId: string): Promise<{ from: string | null; to: string | null; rows: number }> {
  const r = await db()
    .prepare("SELECT MIN(date) AS from_date, MAX(date) AS to_date, COUNT(*) AS n FROM rollups WHERE site_id = ? AND report = 'totals'")
    .bind(siteId)
    .first<{ from_date: string | null; to_date: string | null; n: number }>();
  const all = await db().prepare('SELECT COUNT(*) AS n FROM rollups WHERE site_id = ?').bind(siteId).first<{ n: number }>();
  return { from: r?.from_date ?? null, to: r?.to_date ?? null, rows: all?.n ?? 0 };
}

/** Per family for a site: the first day it holds and its row count (which families it holds, and since when). */
export async function familySpans(siteId: string): Promise<Map<string, { from: string; rows: number }>> {
  const { results } = await db().prepare('SELECT report, MIN(date) AS from_date, COUNT(*) AS n FROM rollups WHERE site_id = ? GROUP BY report').bind(siteId).all<{ report: string; from_date: string; n: number }>();
  return new Map(results.map((r) => [r.report, { from: r.from_date, rows: r.n }]));
}

/** The first day a site holds (for the "All time" preset), or null before its first backfill. */
export async function earliestDate(siteId: string): Promise<string | null> {
  const r = await db().prepare("SELECT MIN(date) AS d FROM rollups WHERE site_id = ? AND report = 'totals'").bind(siteId).first<{ d: string | null }>();
  return r?.d ?? null;
}

/** Coverage of the pair families (drill-down) for a site: the span and row count. */
export async function pairSpan(siteId: string): Promise<{ from: string | null; to: string | null; rows: number }> {
  const keys = PAIRS.map((p) => `'${p.key}'`).join(', ');
  const r = await db()
    .prepare(`SELECT MIN(date) AS from_date, MAX(date) AS to_date, COUNT(*) AS n FROM rollups WHERE site_id = ? AND report IN (${keys})`)
    .bind(siteId)
    .first<{ from_date: string | null; to_date: string | null; n: number }>();
  return { from: r?.from_date ?? null, to: r?.to_date ?? null, rows: r?.n ?? 0 };
}
