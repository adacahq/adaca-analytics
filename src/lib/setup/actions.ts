'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getProperty } from '@/lib/google/admin';
import { bigQuery } from '@/lib/google/bigquery';
import { bqTablesSql } from '@/lib/analytics/bq-sql';
import { enqueueBackfill } from '@/lib/analytics/ingest';
import { createRun, cancelActiveRuns } from '@/lib/db/ingestRuns';
import { createSite, deleteSite, getSite, updateSite, type SiteInput } from '@/lib/db/sites';
import { addDays, todayInZone } from '@/lib/analytics/ranges';
import { SITE_COOKIE } from '@/lib/context';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : String(e);
  const hint = e instanceof Error && 'hint' in e && typeof e.hint === 'string' && e.hint ? ` ${e.hint}` : '';
  return { ok: false, error: `${msg}${hint}` };
}

async function remember(siteId: string) {
  const jar = await cookies();
  jar.set(SITE_COOKIE, siteId, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
}

/** Wizard: a site backed by a GA4 property (optionally with its BigQuery export). */
export async function createGa4Site(input: {
  propertyId: string;
  name?: string;
  backfillDays: number;
  bqProject?: string;
  bqDataset?: string;
}): Promise<ActionResult<{ siteId: string }>> {
  try {
    const id = input.propertyId.replace(/^properties\//, '').trim();
    if (!/^\d+$/.test(id)) return { ok: false, error: 'A GA4 property id is a number, such as 351349891.' };
    const prop = await getProperty(id);
    const bq = Boolean(input.bqProject && input.bqDataset);
    const site = await createSite({
      name: input.name?.trim() || prop.displayName,
      ga_property_id: id,
      timezone: prop.timeZone,
      currency: prop.currencyCode,
      primary_source: bq ? 'bigquery' : 'ga4',
      bq_project_id: bq ? input.bqProject!.trim() : null,
      bq_dataset: bq ? input.bqDataset!.trim() : null,
      backfill_days: input.backfillDays,
    });
    await enqueueBackfill(site, { days: input.backfillDays });
    await remember(site.id);
    revalidatePath('/', 'layout');
    return { ok: true, data: { siteId: site.id } };
  } catch (e) {
    return fail(e);
  }
}

/** Wizard: a site with no GA property — rollups come from a BigQuery export only. */
export async function createBigQuerySite(input: {
  name: string;
  bqProject: string;
  bqDataset: string;
  timezone: string;
  keyEvents: string;
  from: string;
  to: string;
}): Promise<ActionResult<{ siteId: string }>> {
  try {
    if (!input.name.trim()) return { ok: false, error: 'Give the site a name.' };
    if (!input.bqProject.trim() || !input.bqDataset.trim()) return { ok: false, error: 'Project and dataset are required.' };
    const site = await createSite({
      name: input.name.trim(),
      ga_property_id: null,
      timezone: input.timezone.trim() || 'UTC',
      currency: 'USD',
      primary_source: 'bigquery',
      bq_project_id: input.bqProject.trim(),
      bq_dataset: input.bqDataset.trim(),
      bq_key_events: input.keyEvents.trim() || 'purchase',
      backfill_days: 90,
    });
    await enqueueBackfill(site, { from: input.from, to: input.to });
    await remember(site.id);
    revalidatePath('/', 'layout');
    return { ok: true, data: { siteId: site.id } };
  } catch (e) {
    return fail(e);
  }
}

/** Wizard: can the service account query this dataset, and which days does it hold? */
export async function testBigQuery(input: { project: string; dataset: string }): Promise<ActionResult<{ tables: number; first: string | null; last: string | null }>> {
  try {
    const ref = input.dataset.includes('.') ? input.dataset.trim() : `${input.project.trim()}.${input.dataset.trim()}`;
    const res = await bigQuery(input.project.trim(), bqTablesSql(ref), { timeoutMs: 20_000 });
    const row = res.rows[0] ?? {};
    const toIso = (t: string | null | undefined) => (t ? `${t.slice(7, 11)}-${t.slice(11, 13)}-${t.slice(13, 15)}` : null);
    return { ok: true, data: { tables: Number(row.n) || 0, first: toIso(row.first_table), last: toIso(row.last_table) } };
  } catch (e) {
    return fail(e);
  }
}

/** Settings → Sites: edit. */
export async function updateSiteAction(id: string, patch: Partial<SiteInput>): Promise<ActionResult> {
  try {
    await updateSite(id, patch);
    revalidatePath('/', 'layout');
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** Settings → Sites: remove (rollups and runs go with it). */
export async function deleteSiteAction(id: string): Promise<ActionResult> {
  try {
    await deleteSite(id);
    revalidatePath('/', 'layout');
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** Settings → Ingestion: re-ingest the trailing 3 days now. */
export async function refreshNow(siteId: string): Promise<ActionResult> {
  try {
    const site = await getSite(siteId);
    if (!site) return { ok: false, error: 'Site not found' };
    const today = todayInZone(site.timezone);
    await createRun({ site_id: site.id, kind: 'manual', from_date: addDays(today, -2), to_date: today });
    revalidatePath('/settings/ingestion');
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** Settings → Ingestion: a fresh backfill (cancels anything queued for the site). */
export async function backfillSite(siteId: string, window: { days?: number; from?: string; to?: string }): Promise<ActionResult> {
  try {
    const site = await getSite(siteId);
    if (!site) return { ok: false, error: 'Site not found' };
    await cancelActiveRuns(site.id);
    await enqueueBackfill(site, window, 'backfill');
    revalidatePath('/settings/ingestion');
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
