import { ensureRefreshRuns, pump } from './ingest';
import { runReports } from '@/lib/reports/schedule';

/**
 * The cron tick (wrangler.jsonc `triggers.crons`, every 15 minutes): queue
 * the hourly refresh for any site that is due, spend up to ~22 s of wall
 * time advancing whatever is queued, then deliver any report or alert that
 * is due. Cheap when idle — a couple of D1
 * reads. `env` is unused directly: bindings are reached through
 * `cloudflare:workers` inside the engine.
 */
export interface TickResult {
  summary: string;
}

export async function runScheduled(_env: Env): Promise<TickResult> {
  const queued = await ensureRefreshRuns();
  const r = await pump({ budgetMs: 22_000, maxUnits: 60 });
  // Reports and alerts after the pump, so a summary reads the freshest rollups.
  const reports = await runReports().catch((e) => {
    console.error('reports tick failed', e);
    return { sent: 0, failed: 0 };
  });
  return {
    summary: `queued ${queued}; ${r.units} unit(s), ${r.rows} row(s); finished ${r.finished.length}; failed ${r.failed.length}; remaining ${r.remaining}; reports sent ${reports.sent}, failed ${reports.failed}`,
  };
}
