'use server';

import { listDashboards } from '@/lib/db/dashboards';
import { listSites } from '@/lib/db/sites';
import { createShare, listShares, revokeShare } from '@/lib/db/shares';
import { currentSite } from '@/lib/context';
import { isIsoDay, type RangeParams } from '@/lib/analytics/ranges';
import { parseSegment, segmentParam } from '@/lib/analytics/segments';

export type ShareResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export interface ShareRow {
  id: string;
  token: string;
  name: string;
  created_at: string;
  /** The locked range params, or null when the viewer picks the period. */
  lock: RangeParams | null;
  seg: string | null;
}

function parseLock(raw: string | null): RangeParams | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as RangeParams;
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

/** The active links of a dashboard, newest first. */
export async function listSharesAction(dashboardId: string): Promise<ShareRow[]> {
  const rows = await listShares(dashboardId);
  return rows.map((r) => ({ id: r.id, token: r.token, name: r.name, created_at: r.created_at, lock: parseLock(r.lock_range), seg: r.seg }));
}

/**
 * A new link for the current site's view of a dashboard. `lockRange` pins the
 * period the reader sees; `seg` pins the dashboard filter (a slice can be
 * shared without the rest).
 */
export async function createShareAction(dashboardId: string, opts: { name: string; lockRange: RangeParams | null; seg: string | null }): Promise<ShareResult<ShareRow>> {
  try {
    const dashboard = (await listDashboards()).find((d) => d.id === dashboardId);
    if (!dashboard) return { ok: false, error: 'Dashboard not found' };
    const site = await currentSite(await listSites());
    if (!site) return { ok: false, error: 'No site selected' };
    let lock: RangeParams | null = null;
    if (opts.lockRange) {
      const l = opts.lockRange;
      lock = {
        range: typeof l.range === 'string' ? l.range.slice(0, 20) : undefined,
        from: isIsoDay(l.from) ? l.from : undefined,
        to: isIsoDay(l.to) ? l.to : undefined,
        compare: typeof l.compare === 'string' ? l.compare.slice(0, 40) : undefined,
      };
    }
    const seg = opts.seg ? parseSegment(opts.seg) : null;
    const row = await createShare({
      dashboard_id: dashboard.id,
      site_id: site.id,
      name: opts.name.trim().slice(0, 80),
      lock_range: lock ? JSON.stringify(lock) : null,
      seg: seg ? segmentParam(seg) : null,
    });
    return { ok: true, data: { id: row.id, token: row.token, name: row.name, created_at: row.created_at, lock, seg: row.seg } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not create the link' };
  }
}

export async function revokeShareAction(id: string): Promise<ShareResult> {
  try {
    await revokeShare(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not revoke the link' };
  }
}
