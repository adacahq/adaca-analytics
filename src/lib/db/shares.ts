import { db } from './client';
import { nanoid } from './nanoid';

/**
 * A share link: a read-only view of one dashboard for one site at
 * /share/<token>, open without the deployment's gate. The period can be
 * locked (the range params as JSON) and a segment pinned (the URL form).
 */
export interface Share {
  id: string;
  created_at: string;
  updated_at: string;
  dashboard_id: string;
  site_id: string;
  token: string;
  name: string;
  lock_range: string | null;
  seg: string | null;
  revoked_at: string | null;
}

const COLS = 'id, created_at, updated_at, dashboard_id, site_id, token, name, lock_range, seg, revoked_at';

export async function listShares(dashboardId: string): Promise<Share[]> {
  const { results } = await db()
    .prepare(`SELECT ${COLS} FROM shares WHERE dashboard_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`)
    .bind(dashboardId)
    .all<Share>();
  return results;
}

export async function getShareByToken(token: string): Promise<Share | null> {
  if (!/^[a-z0-9]{16,40}$/.test(token)) return null;
  return db().prepare(`SELECT ${COLS} FROM shares WHERE token = ? AND revoked_at IS NULL`).bind(token).first<Share>();
}

export async function createShare(input: { dashboard_id: string; site_id: string; name: string; lock_range: string | null; seg: string | null }): Promise<Share> {
  const id = nanoid();
  const token = nanoid(24);
  await db()
    .prepare('INSERT INTO shares (id, dashboard_id, site_id, token, name, lock_range, seg) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, input.dashboard_id, input.site_id, token, input.name, input.lock_range, input.seg)
    .run();
  const row = await db().prepare(`SELECT ${COLS} FROM shares WHERE id = ?`).bind(id).first<Share>();
  if (!row) throw new Error('Share insert failed');
  return row;
}

/** Revoking keeps the row (an audit trail) but the token stops resolving. */
export async function revokeShare(id: string): Promise<void> {
  await db().prepare("UPDATE shares SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(id).run();
}
