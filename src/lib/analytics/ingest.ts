/**
 * The ingestion engine — bounded unit pumping.
 *
 * A run covers (site, date window). Work is cut into UNITS: one report
 * family × one ≤31-day chunk × one page of rows. `advanceRun` does exactly
 * one unit and persists the cursor, so a unit can execute inside any
 * invocation budget (a cron tick, a pump request from the browser) and a
 * crash mid-run loses at most one unit. `pump` loops units until a time
 * budget runs out.
 */
import { addDays, daysBetween, todayInZone } from './ranges';
import { GA_METRICS, REPORTS, gaDateToIso, mergeRows, normaliseKeys, type ReportKey, type RollupRow } from './reports';
import { bqSql, datasetRef } from './bq-sql';
import { clearRollups, writeRollups } from './rollups';
import { runReport } from '@/lib/google/ga4';
import { bigQuery } from '@/lib/google/bigquery';
import { listKeyEvents } from '@/lib/google/admin';
import { GoogleApiError } from '@/lib/google/http';
import { kv } from '@/lib/db/client';
import { getSite, listSites, setLastIngestedDate, type Site } from '@/lib/db/sites';
import {
  createRun,
  latestRun,
  listActiveRuns,
  markDone,
  markFailed,
  markStarted,
  updateRun,
  type IngestRun,
} from '@/lib/db/ingestRuns';

const CHUNK_DAYS = 31;
const GA_PAGE = 100_000;
/** The trailing window an hourly refresh re-ingests (GA settles late data for ~72h). */
const REFRESH_DAYS = 3;
const REFRESH_EVERY_MS = 55 * 60 * 1000;

export interface Cursor {
  report: number; // index into the family list for this site
  chunk: string; // start date of the current chunk
  offset: number; // GA row offset within (report, chunk)
}

function parseCursor(raw: string): Cursor {
  try {
    const c = JSON.parse(raw) as Partial<Cursor>;
    return { report: c.report ?? 0, chunk: c.chunk ?? '', offset: c.offset ?? 0 };
  } catch {
    return { report: 0, chunk: '', offset: 0 };
  }
}

function familiesFor(site: Site): ReportKey[] {
  return REPORTS.filter((r) => (site.primary_source === 'bigquery' ? r.bq : true)).map((r) => r.key);
}

/** Total units a run needs (families × chunks), for progress display. */
export function unitsFor(site: Site, from: string, to: string): number {
  const chunks = Math.ceil(daysBetween(from, to) / CHUNK_DAYS);
  return familiesFor(site).length * chunks;
}

function chunkEnd(chunkStart: string, to: string): string {
  const end = addDays(chunkStart, CHUNK_DAYS - 1);
  return end < to ? end : to;
}

/** Key events for BigQuery derivations: the property's list, else the site's own. */
async function keyEventsFor(site: Site): Promise<string[]> {
  if (site.ga_property_id) {
    const cacheKey = `keyevents:${site.ga_property_id}`;
    try {
      const cached = await kv().get(cacheKey, 'json');
      if (cached) return cached as string[];
    } catch {
      // fall through
    }
    const list = await listKeyEvents(site.ga_property_id);
    try {
      await kv().put(cacheKey, JSON.stringify(list), { expirationTtl: 3600 });
    } catch {
      // not fatal
    }
    return list;
  }
  return (site.bq_key_events ?? 'purchase')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function fetchGaUnit(site: Site, family: ReportKey, from: string, to: string, offset: number): Promise<{ rows: RollupRow[]; more: boolean }> {
  const def = REPORTS.find((r) => r.key === family)!;
  const res = await runReport(site.ga_property_id!, {
    dimensions: ['date', ...def.gaDimensions],
    metrics: [...GA_METRICS],
    dateRanges: [{ startDate: from, endDate: to }],
    limit: GA_PAGE,
    offset,
    orderBy: { dimension: 'date' },
  });
  const rows: RollupRow[] = res.rows.map((r) => {
    const [d, ...dims] = r.dims;
    const { key1, key2 } = normaliseKeys(family, dims);
    return { date: gaDateToIso(d), key1, key2, metrics: r.mets };
  });
  return { rows: mergeRows(rows), more: offset + res.rows.length < res.rowCount };
}

async function fetchBqUnit(site: Site, family: ReportKey, from: string, to: string): Promise<RollupRow[]> {
  const sql = bqSql({ datasetRef: datasetRef(site), timezone: site.timezone, keyEvents: await keyEventsFor(site) }, family, from, to);
  if (!sql) return [];
  const res = await bigQuery(site.bq_project_id!, sql);
  const rows: RollupRow[] = res.rows.map((r) => ({
    date: gaDateToIso(r.date ?? ''),
    key1: r.key1 ?? '',
    key2: r.key2 ?? '',
    metrics: [
      Number(r.users) || 0,
      Number(r.new_users) || 0,
      Number(r.sessions) || 0,
      Number(r.engaged_sessions) || 0,
      Number(r.pageviews) || 0,
      Number(r.engagement_seconds) || 0,
      Number(r.key_events) || 0,
      Number(r.event_count) || 0,
    ],
  }));
  return mergeRows(rows);
}

/** One unit of work. Returns whether the run is finished. */
export async function advanceRun(run: IngestRun, site: Site): Promise<{ done: boolean; rows: number }> {
  const families = familiesFor(site);
  const cur = parseCursor(run.cursor);
  if (!cur.chunk) cur.chunk = run.from_date;
  if (cur.report >= families.length) {
    await finish(run, site);
    return { done: true, rows: 0 };
  }
  if (run.status !== 'running') await markStarted(run.id);

  const family = families[cur.report];
  const end = chunkEnd(cur.chunk, run.to_date);
  let rows: RollupRow[] = [];
  let more = false;

  if (site.primary_source === 'bigquery') {
    rows = await fetchBqUnit(site, family, cur.chunk, end);
  } else {
    const r = await fetchGaUnit(site, family, cur.chunk, end, cur.offset);
    rows = r.rows;
    more = r.more;
  }

  // First page of a (family, chunk): clear the window so vanished rows don't linger.
  if (cur.offset === 0) await clearRollups(site.id, family, cur.chunk, end);
  const written = await writeRollups(site.id, family, rows);

  // Advance the cursor: next page → next chunk → next family.
  let next: Cursor;
  if (more) next = { ...cur, offset: cur.offset + GA_PAGE };
  else if (end < run.to_date) next = { report: cur.report, chunk: addDays(end, 1), offset: 0 };
  else next = { report: cur.report + 1, chunk: run.from_date, offset: 0 };

  const finished = next.report >= families.length;
  await updateRun(run.id, { cursor: JSON.stringify(next), rows_written: run.rows_written + written, units: run.units + 1 });
  run.cursor = JSON.stringify(next);
  run.rows_written += written;
  run.units += 1;
  if (finished) await finish(run, site);
  return { done: finished, rows: written };
}

async function finish(run: IngestRun, site: Site): Promise<void> {
  await markDone(run.id);
  await setLastIngestedDate(site.id, run.to_date);
}

export interface PumpSummary {
  units: number;
  rows: number;
  finished: string[];
  failed: { id: string; error: string }[];
  remaining: number;
}

/**
 * Loop units across active runs until the time budget or unit cap is spent.
 * Runs are processed oldest first, one at a time, so a backfill never
 * starves the refresh that queued behind it for long: each unit is small.
 */
export async function pump(opts: { siteId?: string; budgetMs?: number; maxUnits?: number } = {}): Promise<PumpSummary> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 20_000;
  const maxUnits = opts.maxUnits ?? 40;
  const summary: PumpSummary = { units: 0, rows: 0, finished: [], failed: [], remaining: 0 };
  const runs = await listActiveRuns(opts.siteId);
  const sites = new Map<string, Site>();

  for (const run of runs) {
    if (Date.now() - started > budget || summary.units >= maxUnits) break;
    const site = sites.get(run.site_id) ?? (await getSite(run.site_id));
    if (!site) {
      await markFailed(run.id, 'site deleted');
      continue;
    }
    sites.set(site.id, site);
    while (Date.now() - started <= budget && summary.units < maxUnits) {
      try {
        const r = await advanceRun(run, site);
        summary.units += 1;
        summary.rows += r.rows;
        if (r.done) {
          summary.finished.push(run.id);
          break;
        }
      } catch (e) {
        const msg = e instanceof GoogleApiError ? `${e.message}${e.hint ? ` ${e.hint}` : ''}` : e instanceof Error ? e.message : String(e);
        // Quota exhaustion is transient: leave the run queued for the next tick.
        if (e instanceof GoogleApiError && e.status === 429) {
          summary.failed.push({ id: run.id, error: 'quota; will retry' });
        } else {
          await markFailed(run.id, msg);
          summary.failed.push({ id: run.id, error: msg });
        }
        break;
      }
    }
  }
  summary.remaining = (await listActiveRuns(opts.siteId)).length;
  return summary;
}

/** Queue a backfill covering `days` back from today (property time), or an explicit window. */
export async function enqueueBackfill(site: Site, window: { days?: number; from?: string; to?: string }, kind: 'backfill' | 'manual' = 'backfill'): Promise<IngestRun> {
  const today = todayInZone(site.timezone);
  const to = window.to ?? today;
  const from = window.from ?? addDays(to, -(window.days ?? site.backfill_days) + 1);
  return createRun({ site_id: site.id, kind, from_date: from, to_date: to });
}

/**
 * Hourly refresh: re-ingest the trailing window for every site that has no
 * active run and whose last refresh is older than ~an hour. Called by the
 * cron tick before pumping, so the tick's own budget then advances it.
 */
export async function ensureRefreshRuns(now: Date = new Date()): Promise<number> {
  let queued = 0;
  for (const site of await listSites()) {
    const active = await listActiveRuns(site.id);
    if (active.length) continue;
    const last = await latestRun(site.id, 'refresh');
    const stamp = last?.finished_at ?? last?.created_at;
    if (stamp && now.getTime() - new Date(stamp).getTime() < REFRESH_EVERY_MS) continue;
    // A site that has never been backfilled gets its backfill first, not a refresh.
    if (!site.last_ingested_date) {
      await enqueueBackfill(site, {});
      queued++;
      continue;
    }
    const today = todayInZone(site.timezone, now);
    await createRun({ site_id: site.id, kind: 'refresh', from_date: addDays(today, -(REFRESH_DAYS - 1)), to_date: today });
    queued++;
  }
  return queued;
}
