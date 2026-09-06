/**
 * The report families — the canonical daily rollups every site is ingested
 * into. Pure data + pure functions; the GA4 and BigQuery ingesters and the
 * query engine all read this one registry.
 *
 * Every family shares the same eight metric columns so the query layer is
 * one SQL shape; a family differs only in which dimension(s) fill key1/key2.
 */

export type SingleKey =
  | 'totals'
  | 'page'
  | 'landing'
  | 'source'
  | 'channel'
  | 'campaign'
  | 'referrer'
  | 'geo'
  | 'device'
  | 'browser'
  | 'language'
  | 'screen'
  | 'user_type'
  | 'event'
  | 'hour'
  | 'region'
  | 'utm_content'
  | 'utm_term'
  | 'os_version'
  | 'host';

/**
 * Pair families: two dimensions per row, the precomputed basis of drill-down.
 * key1 × key2 as named; "sm" is GA's combined `sessionSourceMedium`
 * ("google / organic"), so source and medium entities filter it with LIKE.
 */
export type PairKey =
  | 'sm_landing'
  | 'sm_page'
  | 'sm_country'
  | 'sm_device'
  | 'sm_event'
  | 'channel_sm'
  | 'channel_landing'
  | 'channel_page'
  | 'channel_country'
  | 'campaign_landing'
  | 'referrer_page'
  | 'page_country'
  | 'page_device'
  | 'page_event'
  | 'landing_country'
  | 'landing_device'
  | 'country_device';

export type ReportKey = SingleKey | PairKey;

export interface ReportFamily {
  key: ReportKey;
  label: string;
  /** GA4 Data API dimension names filling key1 (and key2). */
  gaDimensions: string[];
  keyLabels: [string] | [string, string] | [];
  /** False when the BigQuery export cannot derive it (rows stay empty for BQ sites). */
  bq: boolean;
  /** Two-dimension family ingested only when the site has drill-down on. */
  pair: boolean;
  /** Session-level families rank by sessions; event-level by event count. */
  level: 'session' | 'event';
}

export const REPORTS: ReportFamily[] = [
  { key: 'totals', label: 'Totals', gaDimensions: [], keyLabels: [], bq: true, pair: false, level: 'session' },
  { key: 'page', label: 'Pages', gaDimensions: ['pagePath', 'pageTitle'], keyLabels: ['Page', 'Title'], bq: true, pair: false, level: 'event' },
  { key: 'landing', label: 'Landing pages', gaDimensions: ['landingPage'], keyLabels: ['Landing page'], bq: true, pair: false, level: 'session' },
  { key: 'source', label: 'Sources', gaDimensions: ['sessionSource', 'sessionMedium'], keyLabels: ['Source', 'Medium'], bq: true, pair: false, level: 'session' },
  { key: 'channel', label: 'Channels', gaDimensions: ['sessionDefaultChannelGroup'], keyLabels: ['Channel'], bq: true, pair: false, level: 'session' },
  { key: 'campaign', label: 'Campaigns', gaDimensions: ['sessionCampaignName', 'sessionSource'], keyLabels: ['Campaign', 'Source'], bq: true, pair: false, level: 'session' },
  { key: 'referrer', label: 'Referrers', gaDimensions: ['pageReferrer'], keyLabels: ['Referrer'], bq: true, pair: false, level: 'event' },
  { key: 'geo', label: 'Locations', gaDimensions: ['country', 'city'], keyLabels: ['Country', 'City'], bq: true, pair: false, level: 'session' },
  { key: 'device', label: 'Devices', gaDimensions: ['deviceCategory', 'operatingSystem'], keyLabels: ['Device', 'OS'], bq: true, pair: false, level: 'session' },
  { key: 'browser', label: 'Browsers', gaDimensions: ['browser'], keyLabels: ['Browser'], bq: true, pair: false, level: 'session' },
  { key: 'language', label: 'Languages', gaDimensions: ['language'], keyLabels: ['Language'], bq: true, pair: false, level: 'session' },
  { key: 'screen', label: 'Screens', gaDimensions: ['screenResolution'], keyLabels: ['Resolution'], bq: false, pair: false, level: 'session' },
  { key: 'user_type', label: 'New vs returning', gaDimensions: ['newVsReturning'], keyLabels: ['User type'], bq: true, pair: false, level: 'session' },
  { key: 'event', label: 'Events', gaDimensions: ['eventName', 'isKeyEvent'], keyLabels: ['Event', 'Key event'], bq: true, pair: false, level: 'event' },
  { key: 'hour', label: 'Hour of day', gaDimensions: ['hour'], keyLabels: ['Hour'], bq: true, pair: false, level: 'event' },
  // Added after the first release (2026-09): regions, the two remaining UTM
  // parameters, OS versions and hostnames. Settings → Ingestion offers to
  // backfill families a site does not hold yet.
  { key: 'region', label: 'Regions', gaDimensions: ['country', 'region'], keyLabels: ['Country', 'Region'], bq: true, pair: false, level: 'session' },
  { key: 'utm_content', label: 'Ad content', gaDimensions: ['sessionManualAdContent', 'sessionCampaignName'], keyLabels: ['Ad content', 'Campaign'], bq: true, pair: false, level: 'session' },
  { key: 'utm_term', label: 'Terms', gaDimensions: ['sessionManualTerm', 'sessionCampaignName'], keyLabels: ['Term', 'Campaign'], bq: true, pair: false, level: 'session' },
  { key: 'os_version', label: 'OS versions', gaDimensions: ['operatingSystem', 'operatingSystemVersion'], keyLabels: ['OS', 'Version'], bq: true, pair: false, level: 'session' },
  { key: 'host', label: 'Hostnames', gaDimensions: ['hostName'], keyLabels: ['Hostname'], bq: true, pair: false, level: 'event' },
  // Pair families — all verified compatible with the eight metrics + date (2026-09-06).
  { key: 'sm_landing', label: 'Source / medium × landing page', gaDimensions: ['sessionSourceMedium', 'landingPage'], keyLabels: ['Source / medium', 'Landing page'], bq: true, pair: true, level: 'session' },
  { key: 'sm_page', label: 'Source / medium × page', gaDimensions: ['sessionSourceMedium', 'pagePath'], keyLabels: ['Source / medium', 'Page'], bq: true, pair: true, level: 'event' },
  { key: 'sm_country', label: 'Source / medium × country', gaDimensions: ['sessionSourceMedium', 'country'], keyLabels: ['Source / medium', 'Country'], bq: true, pair: true, level: 'session' },
  { key: 'sm_device', label: 'Source / medium × device', gaDimensions: ['sessionSourceMedium', 'deviceCategory'], keyLabels: ['Source / medium', 'Device'], bq: true, pair: true, level: 'session' },
  { key: 'sm_event', label: 'Source / medium × event', gaDimensions: ['sessionSourceMedium', 'eventName'], keyLabels: ['Source / medium', 'Event'], bq: true, pair: true, level: 'event' },
  { key: 'channel_sm', label: 'Channel × source / medium', gaDimensions: ['sessionDefaultChannelGroup', 'sessionSourceMedium'], keyLabels: ['Channel', 'Source / medium'], bq: true, pair: true, level: 'session' },
  { key: 'channel_landing', label: 'Channel × landing page', gaDimensions: ['sessionDefaultChannelGroup', 'landingPage'], keyLabels: ['Channel', 'Landing page'], bq: true, pair: true, level: 'session' },
  { key: 'channel_page', label: 'Channel × page', gaDimensions: ['sessionDefaultChannelGroup', 'pagePath'], keyLabels: ['Channel', 'Page'], bq: true, pair: true, level: 'event' },
  { key: 'channel_country', label: 'Channel × country', gaDimensions: ['sessionDefaultChannelGroup', 'country'], keyLabels: ['Channel', 'Country'], bq: true, pair: true, level: 'session' },
  { key: 'campaign_landing', label: 'Campaign × landing page', gaDimensions: ['sessionCampaignName', 'landingPage'], keyLabels: ['Campaign', 'Landing page'], bq: true, pair: true, level: 'session' },
  { key: 'referrer_page', label: 'Referrer × page', gaDimensions: ['pageReferrer', 'pagePath'], keyLabels: ['Referrer', 'Page'], bq: true, pair: true, level: 'event' },
  { key: 'page_country', label: 'Page × country', gaDimensions: ['pagePath', 'country'], keyLabels: ['Page', 'Country'], bq: true, pair: true, level: 'event' },
  { key: 'page_device', label: 'Page × device', gaDimensions: ['pagePath', 'deviceCategory'], keyLabels: ['Page', 'Device'], bq: true, pair: true, level: 'event' },
  { key: 'page_event', label: 'Page × event', gaDimensions: ['pagePath', 'eventName'], keyLabels: ['Page', 'Event'], bq: true, pair: true, level: 'event' },
  { key: 'landing_country', label: 'Landing page × country', gaDimensions: ['landingPage', 'country'], keyLabels: ['Landing page', 'Country'], bq: true, pair: true, level: 'session' },
  { key: 'landing_device', label: 'Landing page × device', gaDimensions: ['landingPage', 'deviceCategory'], keyLabels: ['Landing page', 'Device'], bq: true, pair: true, level: 'session' },
  { key: 'country_device', label: 'Country × device', gaDimensions: ['country', 'deviceCategory'], keyLabels: ['Country', 'Device'], bq: true, pair: true, level: 'session' },
];

export const SINGLES: ReportFamily[] = REPORTS.filter((r) => !r.pair);
export const PAIRS: ReportFamily[] = REPORTS.filter((r) => r.pair);

/** Rows kept per pair family per day; the rest fold into one `(other)` row. */
export const PAIR_ROWS_PER_DAY = 1500;
export const OTHER = '(other)';

export const REPORT_BY_KEY: Record<ReportKey, ReportFamily> = Object.fromEntries(REPORTS.map((r) => [r.key, r])) as Record<
  ReportKey,
  ReportFamily
>;

/** Rollup metric columns, in the order the GA metric list below produces them. */
export const METRIC_COLUMNS = [
  'users',
  'new_users',
  'sessions',
  'engaged_sessions',
  'pageviews',
  'engagement_seconds',
  'key_events',
  'event_count',
] as const;
export type MetricColumn = (typeof METRIC_COLUMNS)[number];

/** GA4 Data API metrics, positionally matching METRIC_COLUMNS. */
export const GA_METRICS = [
  'activeUsers',
  'newUsers',
  'sessions',
  'engagedSessions',
  'screenPageViews',
  'userEngagementDuration',
  'keyEvents',
  'eventCount',
] as const;

export interface RollupRow {
  date: string;
  key1: string;
  key2: string;
  metrics: number[]; // length METRIC_COLUMNS.length
}

/** Hostname of a referrer URL, lower-cased, without a leading www. */
export function referrerHost(raw: string): string {
  const v = raw.trim();
  if (!v || v === '(not set)') return '(direct)';
  try {
    const host = new URL(v.includes('://') ? v : `https://${v}`).hostname.toLowerCase();
    return host.replace(/^www\./, '') || v;
  } catch {
    return v.toLowerCase();
  }
}

/** Normalise GA dimension values into the stored key pair for a family. */
export function normaliseKeys(family: ReportKey, dims: string[]): { key1: string; key2: string } {
  const [a = '', b = ''] = dims;
  switch (family) {
    case 'totals':
      return { key1: '', key2: '' };
    case 'referrer':
      return { key1: referrerHost(a), key2: '' };
    case 'referrer_page':
      return { key1: referrerHost(a), key2: b };
    case 'event':
      return { key1: a, key2: b === 'true' ? '1' : '0' };
    case 'hour':
      return { key1: String(Number(a) || 0).padStart(2, '0'), key2: '' };
    default:
      return { key1: a, key2: b };
  }
}

/**
 * Sum rows that collapsed onto the same (date, key1, key2) after
 * normalisation (referrer hosts, mostly). Keeps the writer's upsert exact.
 */
export function mergeRows(rows: RollupRow[]): RollupRow[] {
  const map = new Map<string, RollupRow>();
  for (const r of rows) {
    const k = `${r.date} ${r.key1} ${r.key2}`;
    const cur = map.get(k);
    if (!cur) {
      map.set(k, { ...r, metrics: [...r.metrics] });
    } else {
      for (let i = 0; i < cur.metrics.length; i++) cur.metrics[i] += r.metrics[i] ?? 0;
    }
  }
  return [...map.values()];
}

/** GA returns `date` as YYYYMMDD; rollups store YYYY-MM-DD. */
export function gaDateToIso(d: string): string {
  return /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
}

/**
 * Keep the top `n` rows per day (by sessions for session-level families, by
 * event count for event-level ones) and fold everything else into a single
 * `(other)` row, so totals and shares stay exact while storage stays bounded.
 * Rows arrive merged (no duplicate keys within a day).
 */
export function capPerDay(rows: RollupRow[], n: number, level: 'session' | 'event'): RollupRow[] {
  const byDay = new Map<string, RollupRow[]>();
  for (const r of rows) {
    const list = byDay.get(r.date);
    if (list) list.push(r);
    else byDay.set(r.date, [r]);
  }
  const rank = level === 'event' ? 7 : 2; // METRIC_COLUMNS index: event_count | sessions
  const out: RollupRow[] = [];
  for (const [date, list] of byDay) {
    if (list.length <= n) {
      out.push(...list);
      continue;
    }
    list.sort((a, b) => (b.metrics[rank] ?? 0) - (a.metrics[rank] ?? 0));
    out.push(...list.slice(0, n));
    const other: RollupRow = { date, key1: OTHER, key2: OTHER, metrics: METRIC_COLUMNS.map(() => 0) };
    for (const r of list.slice(n)) for (let i = 0; i < other.metrics.length; i++) other.metrics[i] += r.metrics[i] ?? 0;
    out.push(other);
  }
  return out;
}
