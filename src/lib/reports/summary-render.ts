/**
 * The weekly / monthly summary, the pure half: its shape, the period it
 * covers, and its rendering as email HTML, plain text and Slack blocks.
 * Nothing here touches a binding, so it is unit-tested; `summary.ts` builds
 * one from the query engine.
 */
import { addDays, addMonths, endOfMonth, startOfMonth, startOfWeek } from '@/lib/analytics/ranges';
import { fmtDay } from '@/lib/format';

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
    ...s.tops.map((t) => ({ type: 'section', text: { type: 'mrkdwn', text: `*${t.label}*\n${t.rows.map((r) => `${r.key} · ${r.value}`).join('\n') || '–'}` } })),
  ];
  if (s.url) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `<${s.url}|Open the dashboard for this period>` } });
  return { text, blocks };
}
