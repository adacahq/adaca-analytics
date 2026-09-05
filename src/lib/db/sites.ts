import { db } from './client';
import { nanoid } from './nanoid';

export type SiteSource = 'ga4' | 'bigquery';

export interface Site {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  ga_property_id: string | null;
  timezone: string;
  currency: string;
  primary_source: SiteSource;
  bq_project_id: string | null;
  bq_dataset: string | null;
  backfill_days: number;
  last_ingested_date: string | null;
  position: number;
}

export interface SiteInput {
  name: string;
  ga_property_id: string | null;
  timezone: string;
  currency: string;
  primary_source: SiteSource;
  bq_project_id: string | null;
  bq_dataset: string | null;
  backfill_days: number;
}

const COLS =
  'id, created_at, updated_at, name, ga_property_id, timezone, currency, primary_source, bq_project_id, bq_dataset, backfill_days, last_ingested_date, position';

export async function listSites(): Promise<Site[]> {
  const { results } = await db()
    .prepare(`SELECT ${COLS} FROM sites WHERE deleted_at IS NULL ORDER BY position, created_at`)
    .all<Site>();
  return results;
}

export async function getSite(id: string): Promise<Site | null> {
  return db().prepare(`SELECT ${COLS} FROM sites WHERE id = ? AND deleted_at IS NULL`).bind(id).first<Site>();
}

export async function createSite(input: SiteInput): Promise<Site> {
  const id = nanoid();
  const pos = await db().prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM sites').first<{ p: number }>();
  await db()
    .prepare(
      `INSERT INTO sites (id, name, ga_property_id, timezone, currency, primary_source, bq_project_id, bq_dataset, backfill_days, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.name,
      input.ga_property_id,
      input.timezone,
      input.currency,
      input.primary_source,
      input.bq_project_id,
      input.bq_dataset,
      input.backfill_days,
      pos?.p ?? 0,
    )
    .run();
  const site = await getSite(id);
  if (!site) throw new Error('Site insert failed');
  return site;
}

export async function updateSite(id: string, input: Partial<SiteInput>): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (!sets.length) return;
  vals.push(id);
  await db().prepare(`UPDATE sites SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
}

export async function setLastIngestedDate(id: string, date: string): Promise<void> {
  await db()
    .prepare('UPDATE sites SET last_ingested_date = MAX(COALESCE(last_ingested_date, ?), ?) WHERE id = ?')
    .bind(date, date, id)
    .run();
}

/** Soft delete the site; its rollups and runs go with it (hard) so storage
 *  is reclaimed — the site row itself stays for the audit trail. */
export async function deleteSite(id: string): Promise<void> {
  await db().batch([
    db().prepare('DELETE FROM rollups WHERE site_id = ?').bind(id),
    db().prepare('DELETE FROM ingest_runs WHERE site_id = ?').bind(id),
    db().prepare("UPDATE sites SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(id),
  ]);
}
