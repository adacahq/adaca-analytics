/**
 * Realtime datasets — the last 30 minutes, live from GA's realtime API,
 * cached 30 s in KV so a dashboard with six realtime widgets and several
 * open tabs makes one call per report per half-minute.
 */
import { kv } from '@/lib/db/client';
import type { Site } from '@/lib/db/sites';
import type { ChartType, WidgetConfig, WidgetData } from '@/lib/dashboard/types';
import { runRealtimeReport, type ReportResult } from '@/lib/google/ga4';
import type { Dataset } from './catalog';

const TTL = 30;

async function cached(key: string, load: () => Promise<ReportResult>): Promise<ReportResult> {
  try {
    const hit = await kv().get(key, 'json');
    if (hit) return hit as ReportResult;
  } catch {
    // fall through
  }
  const res = await load();
  try {
    await kv().put(key, JSON.stringify(res), { expirationTtl: TTL });
  } catch {
    // not fatal
  }
  return res;
}

function rankedFrom(res: ReportResult, metricIndex = 0): WidgetData {
  const rows = res.rows.map((r) => ({ key: r.dims[0] || '(not set)', value: r.mets[metricIndex] ?? 0, share: 0 }));
  const total = rows.reduce((a, b) => a + b.value, 0);
  return { kind: 'ranked', rows: rows.map((r) => ({ ...r, share: total > 0 ? r.value / total : 0 })), total };
}

export async function runRealtime(site: Site, ds: Dataset, type: ChartType, config: WidgetConfig): Promise<WidgetData> {
  const pid = site.ga_property_id;
  if (!pid) return { kind: 'empty', reason: 'Realtime needs a GA4 property' };
  const base = `rt:${pid}`;

  if (ds.report === 'rt_now' || ds.report === 'rt_minutes') {
    const res = await cached(`${base}:minutes`, () =>
      runRealtimeReport(pid, { dimensions: ['minutesAgo'], metrics: ['activeUsers'], limit: 60 }),
    );
    // One point per minute, 29 → 0 minutes ago, zeros filled in.
    const byMin = new Map(res.rows.map((r) => [Number(r.dims[0]), r.mets[0] ?? 0]));
    const points = Array.from({ length: 30 }, (_, i) => {
      const ago = 29 - i;
      return { name: String(ago), value: byMin.get(ago) ?? 0 };
    });
    if (ds.report === 'rt_minutes') return { kind: 'timeseries', bucket: 'minute', points };
    const now = await cached(`${base}:now`, () => runRealtimeReport(pid, { metrics: ['activeUsers'], limit: 1 }));
    return { kind: 'kpi', value: now.rows[0]?.mets[0] ?? 0, previous: null, spark: points.map((p) => p.value) };
  }

  const limit = Math.min(50, Math.max(1, config.limit ?? (type === 'donut' ? 6 : 10)));
  switch (ds.report) {
    case 'rt_pages': {
      const res = await cached(`${base}:pages`, () =>
        runRealtimeReport(pid, { dimensions: ['unifiedScreenName'], metrics: ['activeUsers', 'screenPageViews'], limit: 50, orderByMetric: 'activeUsers' }),
      );
      const data = rankedFrom(res, config.metric === 'pageviews' ? 1 : 0);
      return data.kind === 'ranked' ? { ...data, rows: data.rows.slice(0, limit) } : data;
    }
    case 'rt_countries': {
      const res = await cached(`${base}:countries`, () =>
        runRealtimeReport(pid, { dimensions: ['country'], metrics: ['activeUsers'], limit: 50, orderByMetric: 'activeUsers' }),
      );
      const data = rankedFrom(res);
      return data.kind === 'ranked' ? { ...data, rows: data.rows.slice(0, limit) } : data;
    }
    case 'rt_devices': {
      const res = await cached(`${base}:devices`, () =>
        runRealtimeReport(pid, { dimensions: ['deviceCategory'], metrics: ['activeUsers'], limit: 10, orderByMetric: 'activeUsers' }),
      );
      return rankedFrom(res);
    }
    case 'rt_events': {
      // eventName cannot be paired with activeUsers in the realtime API.
      const res = await cached(`${base}:events`, () =>
        runRealtimeReport(pid, { dimensions: ['eventName'], metrics: ['eventCount'], limit: 50, orderByMetric: 'eventCount' }),
      );
      const data = rankedFrom(res, 0);
      return data.kind === 'ranked' ? { ...data, rows: data.rows.slice(0, limit) } : data;
    }
    default:
      return { kind: 'empty' };
  }
}
