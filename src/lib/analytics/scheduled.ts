/**
 * The cron tick. Kept separate from the ingestion engine so the worker entry
 * has one import and the engine stays testable. Phase 2 wires
 * `advanceIngest` in here; until then the tick only proves the binding chain.
 */
export interface TickResult {
  summary: string;
}

export async function runScheduled(env: Env): Promise<TickResult> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM sites WHERE deleted_at IS NULL').first<{ n: number }>();
  return { summary: `${row?.n ?? 0} site(s); nothing to do yet` };
}
