import { db } from './client';
import { nanoid } from './nanoid';

export type ReportKind = 'weekly' | 'monthly' | 'spike' | 'drop';
export type ReportChannel = 'email' | 'slack';

/** A scheduled summary or a traffic alert, delivered by email or to a Slack webhook. */
export interface Report {
  id: string;
  created_at: string;
  updated_at: string;
  site_id: string;
  kind: ReportKind;
  channel: ReportChannel;
  /** An email address, or a Slack incoming-webhook URL. */
  target: string;
  /** Alerts: live visitors at or above (spike), or visits in the last 12 hours below (drop). */
  threshold: number;
  enabled: number;
  /** The first day of the last period a summary covered (so it is sent once). */
  last_period: string | null;
  last_sent_at: string | null;
  last_error: string | null;
}

const COLS = 'id, created_at, updated_at, site_id, kind, channel, target, threshold, enabled, last_period, last_sent_at, last_error';

export async function listReports(): Promise<Report[]> {
  const { results } = await db().prepare(`SELECT ${COLS} FROM reports ORDER BY created_at`).all<Report>();
  return results;
}

export async function getReport(id: string): Promise<Report | null> {
  return db().prepare(`SELECT ${COLS} FROM reports WHERE id = ?`).bind(id).first<Report>();
}

export async function createReport(input: { site_id: string; kind: ReportKind; channel: ReportChannel; target: string; threshold: number }): Promise<Report> {
  const id = nanoid();
  await db()
    .prepare('INSERT INTO reports (id, site_id, kind, channel, target, threshold) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, input.site_id, input.kind, input.channel, input.target, input.threshold)
    .run();
  const row = await getReport(id);
  if (!row) throw new Error('Report insert failed');
  return row;
}

export async function updateReport(id: string, patch: Partial<Pick<Report, 'target' | 'threshold' | 'enabled' | 'last_period' | 'last_sent_at' | 'last_error'>>): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (!sets.length) return;
  vals.push(id);
  await db().prepare(`UPDATE reports SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
}

export async function deleteReport(id: string): Promise<void> {
  await db().prepare('DELETE FROM reports WHERE id = ?').bind(id).run();
}
