import { ensureRefreshRuns, pump } from './ingest';

/**
 * The cron tick (wrangler.jsonc `triggers.crons`, every 15 minutes): queue
 * the hourly refresh for any site that is due, then spend up to ~25 s of
 * wall time advancing whatever is queued. Cheap when idle — a couple of D1
 * reads. `env` is unused directly: bindings are reached through
 * `cloudflare:workers` inside the engine.
 */
export interface TickResult {
  summary: string;
}

export async function runScheduled(_env: Env): Promise<TickResult> {
  const queued = await ensureRefreshRuns();
  const r = await pump({ budgetMs: 25_000, maxUnits: 60 });
  return {
    summary: `queued ${queued}; ${r.units} unit(s), ${r.rows} row(s); finished ${r.finished.length}; failed ${r.failed.length}; remaining ${r.remaining}`,
  };
}
