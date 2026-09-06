'use server';

import { revalidatePath } from 'next/cache';
import { createReport, deleteReport, getReport, updateReport, type ReportChannel, type ReportKind } from '@/lib/db/reports';
import { getSite } from '@/lib/db/sites';
import { isSlackWebhook } from './deliver';
import { emailConfigured } from './env';
import { sendReportNow } from './schedule';

export type ReportResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const KINDS = new Set<ReportKind>(['weekly', 'monthly', 'spike', 'drop']);
const CHANNELS = new Set<ReportChannel>(['email', 'slack']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validTarget(channel: ReportChannel, target: string): string | null {
  const t = target.trim();
  if (channel === 'email') {
    if (!EMAIL.test(t)) return 'Enter an email address.';
    if (!emailConfigured()) return 'Email is not set up on this deployment: set the RESEND_API_KEY and REPORT_FROM secrets.';
  } else if (!isSlackWebhook(t)) return 'Enter a Slack incoming-webhook URL (https://hooks.slack.com/services/…).';
  return null;
}

export async function createReportAction(input: { siteId: string; kind: string; channel: string; target: string; threshold: number }): Promise<ReportResult<{ id: string }>> {
  try {
    if (!KINDS.has(input.kind as ReportKind) || !CHANNELS.has(input.channel as ReportChannel)) return { ok: false, error: 'Choose a kind and a channel.' };
    const site = await getSite(input.siteId);
    if (!site) return { ok: false, error: 'Site not found' };
    const channel = input.channel as ReportChannel;
    const kind = input.kind as ReportKind;
    const bad = validTarget(channel, input.target);
    if (bad) return { ok: false, error: bad };
    if (kind === 'spike' && !site.ga_property_id) return { ok: false, error: 'A traffic-spike alert needs a GA4 property (live visitors).' };
    const threshold = kind === 'spike' || kind === 'drop' ? Math.max(1, Math.round(Number(input.threshold) || 0)) : 0;
    const row = await createReport({ site_id: site.id, kind, channel, target: input.target.trim(), threshold });
    revalidatePath('/settings/reports');
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not create the report' };
  }
}

export async function setReportEnabledAction(id: string, enabled: boolean): Promise<ReportResult> {
  try {
    await updateReport(id, { enabled: enabled ? 1 : 0 });
    revalidatePath('/settings/reports');
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Update failed' };
  }
}

export async function deleteReportAction(id: string): Promise<ReportResult> {
  try {
    await deleteReport(id);
    revalidatePath('/settings/reports');
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete failed' };
  }
}

/** Deliver now, whatever the schedule: the way to check a channel works. */
export async function sendReportNowAction(id: string): Promise<ReportResult> {
  try {
    const report = await getReport(id);
    if (!report) return { ok: false, error: 'Report not found' };
    await sendReportNow(report);
    revalidatePath('/settings/reports');
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Send failed';
    await updateReport(id, { last_error: msg.slice(0, 500) });
    revalidatePath('/settings/reports');
    return { ok: false, error: msg };
  }
}
