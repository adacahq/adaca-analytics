/**
 * The report scheduler, run by the cron tick after the ingestion pump.
 * Summaries go out once per period, on the first tick after 08:00 site time
 * on Monday (weekly) or the 1st (monthly). Alerts check every tick (spike:
 * live visitors) or once an hour (drop: visits in the last 12 hours) and
 * wait 12 hours before firing again. Failures are stored on the report.
 */
import { db, nowIso } from '@/lib/db/client';
import { getSite, listSites, type Site } from '@/lib/db/sites';
import { listReports, updateReport, type Report } from '@/lib/db/reports';
import { activeUsersNow } from '@/lib/analytics/live';
import { addDays, hourInZone, todayInZone } from '@/lib/analytics/ranges';
import { fmtInt } from '@/lib/format';
import { appUrl } from './app-url';
import { sendEmail, sendSlack } from './deliver';
import { buildSummary, renderEmail, renderSlack, summaryPeriod, summarySubject } from './summary';

const SEND_HOUR = 8;
const ALERT_COOLDOWN_MS = 12 * 60 * 60 * 1000;

function cooled(report: Report, now: Date): boolean {
  if (!report.last_sent_at) return true;
  return now.getTime() - new Date(report.last_sent_at).getTime() >= ALERT_COOLDOWN_MS;
}

/** Visits in the last 12 hours from the hour family (kept current by the hourly refresh). */
async function visitsLast12h(site: Site, now: Date): Promise<number> {
  const today = todayInZone(site.timezone, now);
  const yesterday = addDays(today, -1);
  const hour = hourInZone(site.timezone, now);
  const buckets: [string, string][] = [];
  for (let i = 0; i < 12; i++) {
    const h = hour - i;
    if (h >= 0) buckets.push([today, String(h).padStart(2, '0')]);
    else buckets.push([yesterday, String(h + 24).padStart(2, '0')]);
  }
  const where = buckets.map(() => '(date = ? AND key1 = ?)').join(' OR ');
  const r = await db()
    .prepare(`SELECT COALESCE(SUM(sessions), 0) AS n FROM rollups WHERE site_id = ? AND report = 'hour' AND (${where})`)
    .bind(site.id, ...buckets.flat())
    .first<{ n: number }>();
  return r?.n ?? 0;
}

async function deliverSummary(report: Report, site: Site, now: Date): Promise<void> {
  const summary = await buildSummary(site, report.kind === 'weekly' ? 'weekly' : 'monthly', await appUrl(), now);
  if (report.channel === 'email') {
    const { html, text } = renderEmail(summary);
    await sendEmail(report.target, summarySubject(summary), html, text);
  } else {
    const { text, blocks } = renderSlack(summary);
    await sendSlack(report.target, text, blocks);
  }
}

async function deliverAlert(report: Report, site: Site, figure: number, test: boolean): Promise<void> {
  const base = await appUrl();
  const spike = report.kind === 'spike';
  const headline = spike ? `${fmtInt(figure)} ${figure === 1 ? 'person is' : 'people are'} on ${site.name} right now` : `Only ${fmtInt(figure)} ${figure === 1 ? 'visit' : 'visits'} to ${site.name} in the last 12 hours`;
  const detail = spike ? `The traffic-spike alert fires at ${fmtInt(report.threshold)} live visitors.` : `The traffic-drop alert fires below ${fmtInt(report.threshold)} visits in 12 hours.`;
  const link = base ? `${base}${spike ? '/d/realtime' : '/?range=today'}` : null;
  const subject = `${test ? '[Test] ' : ''}${headline}`;
  if (report.channel === 'email') {
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f7f9"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;font:14px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111"><div style="font:11px/1.4 monospace;letter-spacing:.2em;text-transform:uppercase;color:#6b7280">Adaca Analytics</div><h1 style="font-size:20px;margin:8px 0 8px">${headline}</h1><p style="color:#6b7280;margin:0">${detail}</p>${link ? `<p style="margin:18px 0 0"><a href="${link}" style="color:#1d4ed8">Open the dashboard</a></p>` : ''}</div></body></html>`;
    await sendEmail(report.target, subject, html, `${headline}\n${detail}${link ? `\n${link}` : ''}`);
  } else {
    await sendSlack(report.target, subject, [
      { type: 'section', text: { type: 'mrkdwn', text: `*${subject}*\n${detail}${link ? `\n<${link}|Open the dashboard>` : ''}` } },
    ]);
  }
}

/** Whether a summary is due now, and the period key that marks it sent. */
function summaryDue(report: Report, site: Site, now: Date): string | null {
  const today = todayInZone(site.timezone, now);
  if (hourInZone(site.timezone, now) < SEND_HOUR) return null;
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  if (report.kind === 'weekly' && dow !== 1) return null;
  if (report.kind === 'monthly' && !today.endsWith('-01')) return null;
  const period = summaryPeriod(report.kind === 'weekly' ? 'weekly' : 'monthly', today).from;
  return report.last_period === period ? null : period;
}

export interface ReportsTick {
  sent: number;
  failed: number;
}

/** One pass over every enabled report. Never throws: each report records its own outcome. */
export async function runReports(now: Date = new Date()): Promise<ReportsTick> {
  const out: ReportsTick = { sent: 0, failed: 0 };
  const reports = (await listReports()).filter((r) => r.enabled === 1);
  if (!reports.length) return out;
  const sites = new Map((await listSites()).map((s) => [s.id, s]));
  for (const report of reports) {
    const site = sites.get(report.site_id);
    if (!site) continue;
    try {
      if (report.kind === 'weekly' || report.kind === 'monthly') {
        const period = summaryDue(report, site, now);
        if (!period) continue;
        await deliverSummary(report, site, now);
        await updateReport(report.id, { last_period: period, last_sent_at: nowIso(), last_error: null });
        out.sent++;
      } else if (report.kind === 'spike') {
        if (!site.ga_property_id || !cooled(report, now)) continue;
        const live = await activeUsersNow(site);
        if (live < report.threshold) continue;
        await deliverAlert(report, site, live, false);
        await updateReport(report.id, { last_sent_at: nowIso(), last_error: null });
        out.sent++;
      } else if (report.kind === 'drop') {
        // Once an hour, and only while the hour family is being kept current.
        if (now.getUTCMinutes() >= 15 || !cooled(report, now) || !site.last_ingested_date) continue;
        if (site.last_ingested_date < addDays(todayInZone(site.timezone, now), -1)) continue;
        const visits = await visitsLast12h(site, now);
        if (visits >= report.threshold) continue;
        await deliverAlert(report, site, visits, false);
        await updateReport(report.id, { last_sent_at: nowIso(), last_error: null });
        out.sent++;
      }
    } catch (e) {
      await updateReport(report.id, { last_error: (e instanceof Error ? e.message : String(e)).slice(0, 500) });
      out.failed++;
    }
  }
  return out;
}

/** Send a report now, regardless of schedule (the Settings "Send now" test). */
export async function sendReportNow(report: Report, now: Date = new Date()): Promise<void> {
  const site = await getSite(report.site_id);
  if (!site) throw new Error('Site not found');
  if (report.kind === 'weekly' || report.kind === 'monthly') {
    await deliverSummary(report, site, now);
  } else if (report.kind === 'spike') {
    await deliverAlert(report, site, site.ga_property_id ? await activeUsersNow(site) : 0, true);
  } else {
    await deliverAlert(report, site, await visitsLast12h(site, now), true);
  }
  await updateReport(report.id, { last_sent_at: nowIso(), last_error: null });
}
