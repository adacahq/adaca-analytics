import { db, nowIso } from './client';
import { nanoid } from './nanoid';

export type RunKind = 'backfill' | 'refresh' | 'manual';
export type RunStatus = 'queued' | 'running' | 'done' | 'failed';
/**
 * Which families a run ingests: everything; only the pair families (adding
 * drill-down to an existing window); or an explicit list, `only:a,b,c`
 * (adding families introduced after a site was backfilled).
 */
export type RunScope = 'all' | 'pairs' | `only:${string}`;

/** Human label of a scope for the runs table. */
export function scopeLabel(scope: RunScope | string): string {
  if (scope === 'pairs') return 'drill-down';
  if (scope.startsWith('only:')) return `new reports (${scope.slice(5).split(',').length})`;
  return 'all';
}

export interface IngestRun {
  id: string;
  created_at: string;
  updated_at: string;
  site_id: string;
  kind: RunKind;
  scope: RunScope;
  from_date: string;
  to_date: string;
  cursor: string;
  status: RunStatus;
  rows_written: number;
  units: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

const COLS = 'id, created_at, updated_at, site_id, kind, scope, from_date, to_date, cursor, status, rows_written, units, error, started_at, finished_at';

export async function createRun(input: { site_id: string; kind: RunKind; from_date: string; to_date: string; scope?: RunScope }): Promise<IngestRun> {
  const id = nanoid();
  await db()
    .prepare('INSERT INTO ingest_runs (id, site_id, kind, scope, from_date, to_date) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, input.site_id, input.kind, input.scope ?? 'all', input.from_date, input.to_date)
    .run();
  const run = await getRun(id);
  if (!run) throw new Error('Run insert failed');
  return run;
}

export async function getRun(id: string): Promise<IngestRun | null> {
  return db().prepare(`SELECT ${COLS} FROM ingest_runs WHERE id = ?`).bind(id).first<IngestRun>();
}

/** Runs still owed work, oldest first (backfills before refreshes at equal age is fine). */
export async function listActiveRuns(siteId?: string): Promise<IngestRun[]> {
  const q = siteId
    ? db().prepare(`SELECT ${COLS} FROM ingest_runs WHERE status IN ('queued','running') AND site_id = ? ORDER BY created_at`).bind(siteId)
    : db().prepare(`SELECT ${COLS} FROM ingest_runs WHERE status IN ('queued','running') ORDER BY created_at`);
  const { results } = await q.all<IngestRun>();
  return results;
}

export async function listRuns(limit = 50, siteId?: string): Promise<IngestRun[]> {
  const q = siteId
    ? db().prepare(`SELECT ${COLS} FROM ingest_runs WHERE site_id = ? ORDER BY created_at DESC LIMIT ?`).bind(siteId, limit)
    : db().prepare(`SELECT ${COLS} FROM ingest_runs ORDER BY created_at DESC LIMIT ?`).bind(limit);
  const { results } = await q.all<IngestRun>();
  return results;
}

/** The latest refresh per site, to decide whether another is due. */
export async function latestRun(siteId: string, kind: RunKind): Promise<IngestRun | null> {
  return db()
    .prepare(`SELECT ${COLS} FROM ingest_runs WHERE site_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(siteId, kind)
    .first<IngestRun>();
}

export async function updateRun(
  id: string,
  patch: Partial<Pick<IngestRun, 'cursor' | 'status' | 'rows_written' | 'units' | 'error' | 'started_at' | 'finished_at'>>,
): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (!sets.length) return;
  vals.push(id);
  await db().prepare(`UPDATE ingest_runs SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
}

export async function markStarted(id: string): Promise<void> {
  await db().prepare("UPDATE ingest_runs SET status = 'running', started_at = COALESCE(started_at, ?) WHERE id = ?").bind(nowIso(), id).run();
}

export async function markDone(id: string): Promise<void> {
  await updateRun(id, { status: 'done', finished_at: nowIso(), error: null });
}

export async function markFailed(id: string, error: string): Promise<void> {
  await updateRun(id, { status: 'failed', finished_at: nowIso(), error: error.slice(0, 2000) });
}

/** Drop queued/running runs for a site (used before re-backfilling or deleting). */
export async function cancelActiveRuns(siteId: string): Promise<void> {
  await db()
    .prepare("UPDATE ingest_runs SET status = 'failed', error = 'cancelled', finished_at = ? WHERE site_id = ? AND status IN ('queued','running')")
    .bind(nowIso(), siteId)
    .run();
}
