/**
 * The widget catalogue — the taxonomy the builder walks:
 *   category (data type) → dataset (specific data) → chart type → configure.
 * Pure data; the query engine and the builder both read it.
 */
import type { ChartType } from '@/lib/dashboard/types';
import type { ReportKey } from './reports';
import type { MetricKey } from './metrics';
import type { EntityKind } from './entities';

export type CategoryKey = 'overview' | 'realtime' | 'acquisition' | 'content' | 'audience' | 'behaviour';

export interface Category {
  key: CategoryKey;
  label: string;
  description: string;
}

export const CATEGORIES: Category[] = [
  { key: 'overview', label: 'Overview', description: 'Totals over time: visitors, visits, pageviews, key events.' },
  { key: 'realtime', label: 'Realtime', description: 'Who is on the site right now, live from Google Analytics.' },
  { key: 'acquisition', label: 'Acquisition', description: 'Where visits come from: channels, sources, campaigns, referrers.' },
  { key: 'content', label: 'Content', description: 'What people look at: pages, landing pages, titles.' },
  { key: 'audience', label: 'Audience', description: 'Who visits: countries, cities, devices, browsers, languages.' },
  { key: 'behaviour', label: 'Behaviour', description: 'What people do: events, key events, when they visit.' },
];

/** Realtime datasets read GA live; everything else reads the rollups. */
export interface Dataset {
  key: string;
  category: CategoryKey;
  label: string;
  description: string;
  /** Rollup family, or the realtime report name. */
  report: ReportKey | 'rt_now' | 'rt_minutes' | 'rt_pages' | 'rt_countries' | 'rt_devices' | 'rt_events';
  /** Which stored key carries the dimension shown (key1 unless noted). */
  dim: 'key1' | 'key2' | 'none';
  dimLabel: string;
  /** Optional second dimension shown as a sub-label (pages: title; sources: medium; regions: country). */
  subDim?: 'key1' | 'key2';
  /** Fixed filter applied to every query (events → key events only). */
  where?: { dim: 'key1' | 'key2'; value: string };
  metrics: MetricKey[];
  defaultMetric: MetricKey;
  charts: ChartType[];
  live: boolean;
  /** The entity a row of this dataset opens (drill-down); rows without one are plain. */
  drill?: EntityKind;
  /** Pair-backed datasets: the label of the other key, which the filter UI targets. */
  otherLabel?: string;
  /** What an exact filter on each stored key opens (defaults to `drill` for the shown key). */
  keyKinds?: { key1?: EntityKind; key2?: EntityKind };
}

const SESSION_METRICS: MetricKey[] = ['sessions', 'users', 'newUsers', 'engagedSessions', 'engagementRate', 'bounceRate', 'avgEngagementTime', 'pageviews', 'keyEvents', 'keyEventRate'];
const PAGE_METRICS: MetricKey[] = ['pageviews', 'users', 'sessions', 'avgEngagementTime', 'keyEvents', 'eventCount'];
const RANKED: ChartType[] = ['list', 'bar', 'column', 'donut', 'table', 'kpi', 'line'];

export const DATASETS: Dataset[] = [
  // Overview
  {
    key: 'overview.totals',
    category: 'overview',
    label: 'Totals over time',
    description: 'Site-wide visitors, visits, pageviews, engagement and key events.',
    report: 'totals',
    dim: 'none',
    dimLabel: 'Date',
    metrics: [...SESSION_METRICS, 'viewsPerSession', 'eventCount'],
    defaultMetric: 'users',
    charts: ['kpi', 'line', 'column', 'table'],
    live: false,
  },
  // Realtime
  { key: 'realtime.now', category: 'realtime', label: 'Active users now', description: 'People on the site in the last 30 minutes.', report: 'rt_now', dim: 'none', dimLabel: 'Now', metrics: ['users'], defaultMetric: 'users', charts: ['kpi'], live: true },
  { key: 'realtime.minutes', category: 'realtime', label: 'Active users by minute', description: 'The last 30 minutes, minute by minute.', report: 'rt_minutes', dim: 'key1', dimLabel: 'Minutes ago', metrics: ['users'], defaultMetric: 'users', charts: ['column', 'line'], live: true },
  { key: 'realtime.pages', category: 'realtime', label: 'Pages being viewed', description: 'Which pages have active users right now.', report: 'rt_pages', dim: 'key1', dimLabel: 'Page', metrics: ['users', 'pageviews'], defaultMetric: 'users', charts: ['list', 'bar', 'table'], live: true, drill: 'page' },
  { key: 'realtime.countries', category: 'realtime', label: 'Countries now', description: 'Where active users are.', report: 'rt_countries', dim: 'key1', dimLabel: 'Country', metrics: ['users'], defaultMetric: 'users', charts: ['list', 'bar', 'donut'], live: true, drill: 'country' },
  { key: 'realtime.devices', category: 'realtime', label: 'Devices now', description: 'Desktop, mobile or tablet, right now.', report: 'rt_devices', dim: 'key1', dimLabel: 'Device', metrics: ['users'], defaultMetric: 'users', charts: ['donut', 'list', 'bar'], live: true, drill: 'device' },
  { key: 'realtime.events', category: 'realtime', label: 'Events now', description: 'Events fired in the last 30 minutes.', report: 'rt_events', dim: 'key1', dimLabel: 'Event', metrics: ['eventCount'], defaultMetric: 'eventCount', charts: ['list', 'bar', 'table'], live: true, drill: 'event' },
  // Acquisition
  { key: 'acquisition.channels', category: 'acquisition', label: 'Channels', description: 'Default channel groups: Direct, Organic Search, Referral, Social…', report: 'channel', dim: 'key1', dimLabel: 'Channel', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'channel' },
  { key: 'acquisition.sources', category: 'acquisition', label: 'Sources', description: 'The site or app a visit came from.', report: 'source', dim: 'key1', dimLabel: 'Source', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'source', keyKinds: { key2: 'medium' } },
  { key: 'acquisition.mediums', category: 'acquisition', label: 'Mediums', description: 'How a visit arrived: organic, referral, cpc, email…', report: 'source', dim: 'key2', dimLabel: 'Medium', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'medium', keyKinds: { key1: 'source' } },
  { key: 'acquisition.sourceMedium', category: 'acquisition', label: 'Source / medium', description: 'Source and medium together.', report: 'source', dim: 'key1', subDim: 'key2', dimLabel: 'Source / medium', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'sourceMedium', keyKinds: { key1: 'source', key2: 'medium' } },
  { key: 'acquisition.campaigns', category: 'acquisition', label: 'Campaigns', description: 'Tagged campaigns (utm_campaign).', report: 'campaign', dim: 'key1', subDim: 'key2', dimLabel: 'Campaign', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'campaign', keyKinds: { key2: 'source' } },
  { key: 'acquisition.utmContent', category: 'acquisition', label: 'Ad content', description: 'utm_content of tagged links, with its campaign.', report: 'utm_content', dim: 'key1', subDim: 'key2', dimLabel: 'Ad content', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'utmContent', keyKinds: { key2: 'campaign' } },
  { key: 'acquisition.utmTerm', category: 'acquisition', label: 'Terms', description: 'utm_term of tagged links (paid keywords), with its campaign.', report: 'utm_term', dim: 'key1', subDim: 'key2', dimLabel: 'Term', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'utmTerm', keyKinds: { key2: 'campaign' } },
  { key: 'acquisition.referrers', category: 'acquisition', label: 'Referrers', description: 'Referring hostnames on pageviews.', report: 'referrer', dim: 'key1', dimLabel: 'Referrer', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'referrer' },
  // Content
  { key: 'content.pages', category: 'content', label: 'Pages viewed', description: 'Pageviews and engagement by page path.', report: 'page', dim: 'key1', subDim: 'key2', dimLabel: 'Page', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'page', keyKinds: { key2: 'title' } },
  { key: 'content.titles', category: 'content', label: 'Page titles', description: 'The same, by page title.', report: 'page', dim: 'key2', dimLabel: 'Title', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'title', keyKinds: { key1: 'page' } },
  { key: 'content.landing', category: 'content', label: 'Landing pages', description: 'The first page of each visit.', report: 'landing', dim: 'key1', dimLabel: 'Landing page', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'landing' },
  { key: 'content.hosts', category: 'content', label: 'Hostnames', description: 'Which hostnames of the property were viewed (multi-domain properties).', report: 'host', dim: 'key1', dimLabel: 'Hostname', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'host' },
  // Audience
  { key: 'audience.countries', category: 'audience', label: 'Countries', description: 'Visits by country.', report: 'geo', dim: 'key1', dimLabel: 'Country', metrics: SESSION_METRICS, defaultMetric: 'users', charts: RANKED, live: false, drill: 'country', keyKinds: { key2: 'city' } },
  { key: 'audience.regions', category: 'audience', label: 'Regions', description: 'States and regions, with their country.', report: 'region', dim: 'key2', subDim: 'key1', dimLabel: 'Region', metrics: SESSION_METRICS, defaultMetric: 'users', charts: RANKED, live: false, drill: 'region', keyKinds: { key1: 'country' } },
  { key: 'audience.cities', category: 'audience', label: 'Cities', description: 'Visits by city.', report: 'geo', dim: 'key2', dimLabel: 'City', metrics: SESSION_METRICS, defaultMetric: 'users', charts: RANKED, live: false, drill: 'city', keyKinds: { key1: 'country' } },
  { key: 'audience.devices', category: 'audience', label: 'Devices', description: 'Desktop, mobile, tablet.', report: 'device', dim: 'key1', dimLabel: 'Device', metrics: SESSION_METRICS, defaultMetric: 'users', charts: ['donut', ...RANKED.filter((c) => c !== 'donut')], live: false, drill: 'device', keyKinds: { key2: 'os' } },
  { key: 'audience.os', category: 'audience', label: 'Operating systems', description: 'Windows, macOS, iOS, Android…', report: 'device', dim: 'key2', dimLabel: 'OS', metrics: SESSION_METRICS, defaultMetric: 'users', charts: RANKED, live: false, drill: 'os', keyKinds: { key1: 'device' } },
  { key: 'audience.osVersions', category: 'audience', label: 'OS versions', description: 'Operating system versions, with their OS.', report: 'os_version', dim: 'key2', subDim: 'key1', dimLabel: 'Version', metrics: SESSION_METRICS, defaultMetric: 'users', charts: RANKED, live: false, drill: 'osVersion', keyKinds: { key1: 'os' } },
  { key: 'audience.browsers', category: 'audience', label: 'Browsers', description: 'Chrome, Safari, Firefox…', report: 'browser', dim: 'key1', dimLabel: 'Browser', metrics: SESSION_METRICS, defaultMetric: 'users', charts: RANKED, live: false, drill: 'browser' },
  { key: 'audience.languages', category: 'audience', label: 'Languages', description: 'Browser language of visitors.', report: 'language', dim: 'key1', dimLabel: 'Language', metrics: SESSION_METRICS, defaultMetric: 'users', charts: RANKED, live: false, drill: 'language' },
  { key: 'audience.screens', category: 'audience', label: 'Screen resolutions', description: 'Viewport sizes (GA4 API sites only).', report: 'screen', dim: 'key1', dimLabel: 'Resolution', metrics: SESSION_METRICS, defaultMetric: 'users', charts: RANKED, live: false, drill: 'screen' },
  { key: 'audience.userType', category: 'audience', label: 'New vs returning', description: 'First-time visitors against returning ones.', report: 'user_type', dim: 'key1', dimLabel: 'Visitor type', metrics: SESSION_METRICS, defaultMetric: 'users', charts: ['donut', ...RANKED.filter((c) => c !== 'donut')], live: false, drill: 'userType' },
  // Behaviour
  { key: 'behaviour.events', category: 'behaviour', label: 'Events', description: 'Every event name with its count.', report: 'event', dim: 'key1', dimLabel: 'Event', metrics: ['eventCount', 'users', 'sessions', 'keyEvents'], defaultMetric: 'eventCount', charts: RANKED, live: false, drill: 'event' },
  { key: 'behaviour.keyEvents', category: 'behaviour', label: 'Key events', description: 'Only the events the property marks as key events (conversions).', report: 'event', dim: 'key1', dimLabel: 'Key event', where: { dim: 'key2', value: '1' }, metrics: ['keyEvents', 'users', 'sessions', 'eventCount'], defaultMetric: 'keyEvents', charts: RANKED, live: false, drill: 'event' },
  { key: 'behaviour.hours', category: 'behaviour', label: 'Hour of day', description: 'When people visit, by hour of the property’s day.', report: 'hour', dim: 'key1', dimLabel: 'Hour', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: ['column', 'line', 'bar', 'table'], live: false, drill: 'hour' },
  // Drill-down pairs — two dimensions stored together. Filter on the other key to
  // narrow ("Pages by source" + filter Source / medium = "google / organic").
  { key: 'acquisition.sourcesByPage', category: 'acquisition', label: 'Sources by page', description: 'Source / medium of the visits that viewed a page. Add a filter on Page to narrow.', report: 'sm_page', dim: 'key1', dimLabel: 'Source / medium', otherLabel: 'Page', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'sourceMedium', keyKinds: { key2: 'page' } },
  { key: 'acquisition.sourcesByLanding', category: 'acquisition', label: 'Sources by landing page', description: 'Source / medium of visits that started on a landing page. Add a filter on Landing page to narrow.', report: 'sm_landing', dim: 'key1', dimLabel: 'Source / medium', otherLabel: 'Landing page', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'sourceMedium', keyKinds: { key2: 'landing' } },
  { key: 'acquisition.channelsByLanding', category: 'acquisition', label: 'Channels by landing page', description: 'Channel of visits that started on a landing page. Add a filter on Landing page to narrow.', report: 'channel_landing', dim: 'key1', dimLabel: 'Channel', otherLabel: 'Landing page', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'channel', keyKinds: { key2: 'landing' } },
  { key: 'content.pagesBySource', category: 'content', label: 'Pages by source', description: 'Pages viewed, by the visit’s source / medium. Add a filter on Source / medium to narrow.', report: 'sm_page', dim: 'key2', dimLabel: 'Page', otherLabel: 'Source / medium', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'page', keyKinds: { key1: 'sourceMedium' } },
  { key: 'content.pagesByChannel', category: 'content', label: 'Pages by channel', description: 'Pages viewed, by the visit’s channel. Add a filter on Channel to narrow.', report: 'channel_page', dim: 'key2', dimLabel: 'Page', otherLabel: 'Channel', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'page', keyKinds: { key1: 'channel' } },
  { key: 'content.pagesByReferrer', category: 'content', label: 'Pages by referrer', description: 'Pages viewed, by referring host. Add a filter on Referrer to narrow.', report: 'referrer_page', dim: 'key2', dimLabel: 'Page', otherLabel: 'Referrer', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'page', keyKinds: { key1: 'referrer' } },
  { key: 'content.landingBySource', category: 'content', label: 'Landing pages by source', description: 'Where visits from a source / medium land. Add a filter on Source / medium to narrow.', report: 'sm_landing', dim: 'key2', dimLabel: 'Landing page', otherLabel: 'Source / medium', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'landing', keyKinds: { key1: 'sourceMedium' } },
  { key: 'content.landingByCampaign', category: 'content', label: 'Landing pages by campaign', description: 'Where a campaign’s visits land. Add a filter on Campaign to narrow.', report: 'campaign_landing', dim: 'key2', dimLabel: 'Landing page', otherLabel: 'Campaign', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'landing', keyKinds: { key1: 'campaign' } },
  { key: 'audience.countriesByPage', category: 'audience', label: 'Countries by page', description: 'Where the viewers of a page are. Add a filter on Page to narrow.', report: 'page_country', dim: 'key2', dimLabel: 'Country', otherLabel: 'Page', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'country', keyKinds: { key1: 'page' } },
  { key: 'audience.countriesBySource', category: 'audience', label: 'Countries by source', description: 'Where visits from a source / medium come from. Add a filter on Source / medium to narrow.', report: 'sm_country', dim: 'key2', dimLabel: 'Country', otherLabel: 'Source / medium', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'country', keyKinds: { key1: 'sourceMedium' } },
  { key: 'audience.devicesByLanding', category: 'audience', label: 'Devices by landing page', description: 'Devices of visits that started on a landing page. Add a filter on Landing page to narrow.', report: 'landing_device', dim: 'key2', dimLabel: 'Device', otherLabel: 'Landing page', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: ['donut', ...RANKED.filter((c) => c !== 'donut')], live: false, drill: 'device', keyKinds: { key1: 'landing' } },
  { key: 'behaviour.eventsByPage', category: 'behaviour', label: 'Events by page', description: 'Events fired on a page. Add a filter on Page to narrow.', report: 'page_event', dim: 'key2', dimLabel: 'Event', otherLabel: 'Page', metrics: ['eventCount', 'users', 'sessions', 'keyEvents'], defaultMetric: 'eventCount', charts: RANKED, live: false, drill: 'event', keyKinds: { key1: 'page' } },
  { key: 'behaviour.eventsBySource', category: 'behaviour', label: 'Events by source', description: 'Events fired by visits from a source / medium. Add a filter on Source / medium to narrow.', report: 'sm_event', dim: 'key2', dimLabel: 'Event', otherLabel: 'Source / medium', metrics: ['eventCount', 'users', 'sessions', 'keyEvents'], defaultMetric: 'eventCount', charts: RANKED, live: false, drill: 'event', keyKinds: { key1: 'sourceMedium' } },
  { key: 'behaviour.weekdays', category: 'behaviour', label: 'Day of week', description: 'Visits by weekday, from the daily totals.', report: 'totals', dim: 'none', dimLabel: 'Weekday', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: ['column', 'bar', 'table'], live: false },
];

export const DATASET_BY_KEY: Record<string, Dataset> = Object.fromEntries(DATASETS.map((d) => [d.key, d]));

export function datasetsIn(category: CategoryKey): Dataset[] {
  return DATASETS.filter((d) => d.category === category);
}

/** Datasets that are ordered categories rather than rankings (hours, weekdays, minutes). */
export function isOrdinal(ds: Dataset): boolean {
  return ds.key === 'behaviour.hours' || ds.key === 'behaviour.weekdays' || ds.key === 'realtime.minutes';
}

/** The value a ranked row opens when its dataset drills: the stored value (not the
 *  display label), and source / medium rows combine key and sub. */
export function drillValue(ds: Dataset, row: { key: string; sub?: string; raw?: string }): string {
  const value = row.raw ?? row.key;
  if (ds.key === 'acquisition.sourceMedium' && row.sub) return `${value} / ${row.sub}`;
  return value;
}

/** The entity an exact filter on one stored key names, or null when that key is not an entity. */
export function filterKind(ds: Dataset, dim: 'key1' | 'key2'): EntityKind | null {
  const explicit = ds.keyKinds?.[dim];
  if (explicit) return explicit;
  return ds.dim === dim ? ds.drill ?? null : null;
}

/**
 * Where a KPI tile opens: a widget narrowed by an exact-match filter is the
 * figure for one entity, so the tile is a link to that entity's page. Tiles
 * without such a filter (site-wide numbers) are not links.
 */
export function kpiDrill(ds: Dataset, filters: { dim: 'key1' | 'key2'; op: string; value: string }[] | undefined): { kind: EntityKind; value: string } | null {
  if (ds.live) return null;
  for (const f of filters ?? []) {
    if (f.op !== 'eq' || !f.value) continue;
    const kind = filterKind(ds, f.dim);
    if (kind) return { kind, value: f.value };
  }
  return null;
}

/** The plain dataset that lists an entity kind (Sources for 'source', Pages for 'page'…). */
export function datasetForKind(kind: EntityKind): Dataset | undefined {
  return DATASETS.find((d) => !d.live && !d.otherLabel && d.drill === kind);
}

/**
 * The explore page of a dataset: every row, every metric, sortable and
 * downloadable. `query` is the period (+ segment) to carry; `filters` are a
 * widget's own, carried as JSON.
 */
export function exploreHref(datasetKey: string, opts: { query?: string; metric?: string; filters?: { dim: 'key1' | 'key2'; op: string; value: string }[]; seg?: string } = {}): string {
  const q = new URLSearchParams(opts.query ?? '');
  if (opts.metric) q.set('metric', opts.metric);
  const live = (opts.filters ?? []).filter((f) => f.value);
  if (live.length) q.set('f', JSON.stringify(live));
  if (opts.seg) q.set('seg', opts.seg);
  const qs = q.toString();
  return `/explore/${encodeURIComponent(datasetKey)}${qs ? `?${qs}` : ''}`;
}

/** Labels of key1 and key2 as the filter UI shows them: pair datasets name both sides. */
export function keyLabelsFor(ds: Dataset, fallback: string[]): string[] {
  if (!ds.otherLabel) return fallback;
  return ds.dim === 'key1' ? [ds.dimLabel, ds.otherLabel] : [ds.otherLabel, ds.dimLabel];
}
