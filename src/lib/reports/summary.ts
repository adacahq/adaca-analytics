/**
 * The weekly / monthly summary: the site's headline numbers for the last
 * full week (Monday to Sunday) or month with deltas against the period
 * before, and its top pages, sources and countries. Built from the same
 * query engine the dashboards use, rendered as email HTML, plain text and
 * Slack blocks.
 */
import type { Site } from '@/lib/db/sites';
import { runWidgetQuery } from '@/lib/analytics/query';
import { METRIC_BY_KEY, type MetricKey } from '@/lib/analytics/metrics';
import { addDays, addMonths, endOfMonth, previousPeriod, startOfMonth, startOfWeek, todayInZone, type DateRange } from '@/lib/analytics/ranges';
import { fmtDay, fmtDelta } from '@/lib/format';

export type SummaryKind = 'weekly' | 'monthly';

export interface SummaryKpi {
  label: string;
  value: string;
  delta: string | null;
  tone: 'up' | 'down' | 'flat';
}

export interface SummaryTop {
  label: string;
  metric: string;
  rows: { key: string; value: string }[];
}

export interface Summary {
  kind: SummaryKind;
  siteName: string;
  from: string;
  to: string;
  kpis: SummaryKpi[];
  tops: SummaryTop[];
  /** The dashboard for the same period, when the app knows its own URL. */
  url: string | null;
}

/** The last full week (Mon–Sun) or month before `today`. */
export function summaryPeriod(kind: SummaryKind, today: string): { from: string; to: string } {
  if (kind === 'weekly') {
    const to = addDays(startOfWeek(today), -1);
    return { from: addDays(to, -6), to };
  }
  const lm = addMonths(startOfMonth(today), -1);
  return { from: lm, to: endOfMonth(lm) };
}

const KPIS: MetricKey[] = ['users', 'sessions', 'pageviews', 'engagementRate', 'avgEngagementTime', 'keyEvents'];
const TOPS: { dataset: string; metric: MetricKey; label: string }[] = [
  { dataset: 'content.pages', metric: 'pageviews', label: 'Top pages' },
  { dataset: 'acquisition.sourceMedium', metric: 'sessions', label: 'Top sources' },
  { dataset: 'audience.countries', metric: 'users', label: 'Top countries' },
];

export async function buildSummary(site: Site, kind: SummaryKind, appUrl: string, now: Date = new Date()): Promise<Summary> {
  const today = todayInZone(site.timezone, now);
  const { from, to } = summaryPeriod(kind, today);
  const range: DateRange = { key: 'custom', from, to, compare: 'prev', against: previousPeriod({ from, to }), label: '' };

  const kpis: SummaryKpi[] = [];
  for (const metric of KPIS) {
    const m = METRIC_BY_KEY[metric];
    const r = await runWidgetQuery(site, 'kpi', { dataset: 'overview.totals', metric, compare: true }, range);
    if (r.kind !== 'kpi') continue;
    const delta = r.previous !== null ? fmtDelta(r.value, r.previous) : null;
    const dir = r.previous === null || r.previous === r.value ? 'flat' : r.value > r.previous ? 'up' : 'down';
    const tone: SummaryKpi['tone'] = m.goodDirection === null || dir === 'flat' ? 'flat' : (dir === 'up') === (m.goodDirection === 'up') ? 'up' : 'down';
    kpis.push({ label: m.label, value: m.format(r.value), delta, tone });
  }
  const tops: SummaryTop[] = [];
  for (const t of TOPS) {
    const r = await runWidgetQuery(site, 'list', { dataset: t.dataset, metric: t.metric, limit: 5 }, range);
    if (r.kind !== 'ranked') continue;
    tops.push({ label: t.label, metric: METRIC_BY_KEY[t.metric].short, rows: r.rows.map((row) => ({ key: row.sub ? `${row.key} / ${row.sub}` : row.key, value: METRIC_BY_KEY[t.metric].format(row.value) })) });
  }
  const url = appUrl ? `${appUrl}/?from=${from}&to=${to}&compare=prev` : null;
  return { kind, siteName: site.name, from, to, kpis, tops, url };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

const TONE = { up: '#1f7a4d', down: '#b23b3b', flat: '#6b7280' } as const;

export function summarySubject(s: Summary): string {
  return `${s.siteName}: ${s.kind === 'weekly' ? 'week' : 'month'} of ${fmtDay(s.from)} to ${fmtDay(s.to)}`;
}

/** A plain, table-based email that every client renders alike. */
export function renderEmail(s: Summary): { html: string; text: string } {
  const title = `${s.kind === 'weekly' ? 'Weekly' : 'Monthly'} summary · ${esc(s.siteName)}`;
  const period = `${fmtDay(s.from)} to ${fmtDay(s.to)}, compared with the period before`;
  const kpiCells = s.kpis
    .map(
      (k) =>
        `<td style="padding:12px 14px;border:1px solid #e5e7eb;vertical-align:top"><div style="font:600 22px/1.1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111">${esc(k.value)}</div><div style="font:11px/1.4 monospace;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-top:4px">${esc(k.label)}</div>${k.delta ? `<div style="font:12px/1.4 monospace;color:${TONE[k.tone]};margin-top:4px">${esc(k.delta)} vs prev</div>` : ''}</td>`,
    )
    .join('');
  const topTables = s.tops
    .map(
      (t) =>
        `<h3 style="font:600 13px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:22px 0 8px;color:#111">${esc(t.label)}</h3><table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">${t.rows
          .map((r) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font:13px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111">${esc(r.key)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;font:13px/1.4 monospace;text-align:right;color:#111">${esc(r.value)}</td></tr>`)
          .join('')}</table>`,
    )
    .join('');
  const link = s.url ? `<p style="margin:24px 0 0"><a href="${esc(s.url)}" style="font:13px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d4ed8">Open the dashboard for this period</a></p>` : '';
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f7f9"><div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px"><div style="font:11px/1.4 monospace;letter-spacing:.2em;text-transform:uppercase;color:#6b7280">Adaca Analytics</div><h1 style="font:600 20px/1.3 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:8px 0 4px;color:#111">${title}</h1><p style="font:13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#6b7280;margin:0 0 18px">${esc(period)}</p><table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%"><tr>${kpiCells.slice(0, 3 * 1000)}</tr></table>${topTables}${link}</div></body></html>`;
  const text = [
    `${s.kind === 'weekly' ? 'Weekly' : 'Monthly'} summary · ${s.siteName}`,
    period,
    '',
    ...s.kpis.map((k) => `${k.label}: ${k.value}${k.delta ? ` (${k.delta} vs prev)` : ''}`),
    ...s.tops.flatMap((t) => ['', t.label, ...t.rows.map((r) => `  ${r.key}  ${r.value}`)]),
    ...(s.url ? ['', s.url] : []),
  ].join('\n');
  return { html, text };
}

/** Slack: a header, the KPIs as fields, one section per top list, and the link. */
export function renderSlack(s: Summary): { text: string; blocks: unknown[] } {
  const text = `${s.kind === 'weekly' ? 'Weekly' : 'Monthly'} summary for ${s.siteName}: ${fmtDay(s.from)} to ${fmtDay(s.to)}`;
  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: `${s.siteName} · ${s.kind === 'weekly' ? 'week' : 'month'} of ${fmtDay(s.from)} to ${fmtDay(s.to)}` } },
    { type: 'section', fields: s.kpis.map((k) => ({ type: 'mrkdwn', text: `*${k.value}*${k.delta ? ` (${k.delta})` : ''}\n${k.label}` })) },
    ...s.tops.map((t) => ({ type: 'section', text: { type: 'mrkdwn', text: `*${t.label}*\n${t.rows.map((r) => `${r.key} — ${r.value}`).join('\n') || '–'}` } })),
  ];
  if (s.url) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `<${s.url}|Open the dashboard for this period>` } });
  return { text, blocks };
}
