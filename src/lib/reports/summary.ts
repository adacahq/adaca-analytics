/**
 * The weekly / monthly summary, built from the same query engine the
 * dashboards use: the site's headline numbers for the last full week or
 * month with deltas against the period before, and its top pages, sources
 * and countries. Rendering lives in `summary-render.ts` (pure, tested).
 */
import type { Site } from '@/lib/db/sites';
import { runWidgetQuery } from '@/lib/analytics/query';
import { METRIC_BY_KEY, type MetricKey } from '@/lib/analytics/metrics';
import { previousPeriod, todayInZone, type DateRange } from '@/lib/analytics/ranges';
import { fmtDelta } from '@/lib/format';
import { summaryPeriod, type Summary, type SummaryKind, type SummaryKpi, type SummaryTop } from './summary-render';

export { renderEmail, renderSlack, summaryPeriod, summarySubject } from './summary-render';
export type { Summary, SummaryKind, SummaryKpi, SummaryTop } from './summary-render';

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
