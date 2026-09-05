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
  /** Optional second dimension shown as a sub-label (pages: title; sources: medium). */
  subDim?: 'key2';
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
  { key: 'acquisition.sources', category: 'acquisition', label: 'Sources', description: 'The site or app a visit came from.', report: 'source', dim: 'key1', dimLabel: 'Source', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'source' },
  { key: 'acquisition.mediums', category: 'acquisition', label: 'Mediums', description: 'How a visit arrived: organic, referral, cpc, email…', report: 'source', dim: 'key2', dimLabel: 'Medium', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'medium' },
  { key: 'acquisition.sourceMedium', category: 'acquisition', label: 'Source / medium', description: 'Source and medium together.', report: 'source', dim: 'key1', subDim: 'key2', dimLabel: 'Source / medium', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'sourceMedium' },
  { key: 'acquisition.campaigns', category: 'acquisition', label: 'Campaigns', description: 'Tagged campaigns (utm_campaign).', report: 'campaign', dim: 'key1', subDim: 'key2', dimLabel: 'Campaign', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'campaign' },
  { key: 'acquisition.referrers', category: 'acquisition', label: 'Referrers', description: 'Referring hostnames on pageviews.', report: 'referrer', dim: 'key1', dimLabel: 'Referrer', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'referrer' },
  // Content
  { key: 'content.pages', category: 'content', label: 'Pages viewed', description: 'Pageviews and engagement by page path.', report: 'page', dim: 'key1', subDim: 'key2', dimLabel: 'Page', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'page' },
  { key: 'content.titles', category: 'content', label: 'Page titles', description: 'The same, by page title.', report: 'page', dim: 'key2', dimLabel: 'Title', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'title' },
  { key: 'content.landing', category: 'content', label: 'Landing pages', description: 'The first page of each visit.', report: 'landing', dim: 'key1', dimLabel: 'Landing page', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'landing' },
  // Audience
  { key: 'audience.countries', category: 'audience', label: 'Countries', description: 'Visits by country.', report: 'geo', dim: 'key1', dimLabel: 'Country', metrics: SESSION_METRICS, defaultMetric: 'users', charts: RANKED, live: false, drill: 'country' },
  { key: 'audience.cities', category: 'audience', label: 'Cities', description: 'Visits by city.', report: 'geo', dim: 'key2', dimLabel: 'City', metrics: SESSION_METRICS, defaultMetric: 'users', charts: RANKED, live: false, drill: 'city' },
  { key: 'audience.devices', category: 'audience', label: 'Devices', description: 'Desktop, mobile, tablet.', report: 'device', dim: 'key1', dimLabel: 'Device', metrics: SESSION_METRICS, defaultMetric: 'users', charts: ['donut', ...RANKED.filter((c) => c !== 'donut')], live: false, drill: 'device' },
  { key: 'audience.os', category: 'audience', label: 'Operating systems', description: 'Windows, macOS, iOS, Android…', report: 'device', dim: 'key2', dimLabel: 'OS', metrics: SESSION_METRICS, defaultMetric: 'users', charts: RANKED, live: false, drill: 'os' },
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
  { key: 'acquisition.sourcesByPage', category: 'acquisition', label: 'Sources by page', description: 'Source / medium of the visits that viewed a page. Add a filter on Page to narrow.', report: 'sm_page', dim: 'key1', dimLabel: 'Source / medium', otherLabel: 'Page', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'sourceMedium' },
  { key: 'acquisition.sourcesByLanding', category: 'acquisition', label: 'Sources by landing page', description: 'Source / medium of visits that started on a landing page. Add a filter on Landing page to narrow.', report: 'sm_landing', dim: 'key1', dimLabel: 'Source / medium', otherLabel: 'Landing page', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'sourceMedium' },
  { key: 'acquisition.channelsByLanding', category: 'acquisition', label: 'Channels by landing page', description: 'Channel of visits that started on a landing page. Add a filter on Landing page to narrow.', report: 'channel_landing', dim: 'key1', dimLabel: 'Channel', otherLabel: 'Landing page', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'channel' },
  { key: 'content.pagesBySource', category: 'content', label: 'Pages by source', description: 'Pages viewed, by the visit’s source / medium. Add a filter on Source / medium to narrow.', report: 'sm_page', dim: 'key2', dimLabel: 'Page', otherLabel: 'Source / medium', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'page' },
  { key: 'content.pagesByChannel', category: 'content', label: 'Pages by channel', description: 'Pages viewed, by the visit’s channel. Add a filter on Channel to narrow.', report: 'channel_page', dim: 'key2', dimLabel: 'Page', otherLabel: 'Channel', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'page' },
  { key: 'content.pagesByReferrer', category: 'content', label: 'Pages by referrer', description: 'Pages viewed, by referring host. Add a filter on Referrer to narrow.', report: 'referrer_page', dim: 'key2', dimLabel: 'Page', otherLabel: 'Referrer', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'page' },
  { key: 'content.landingBySource', category: 'content', label: 'Landing pages by source', description: 'Where visits from a source / medium land. Add a filter on Source / medium to narrow.', report: 'sm_landing', dim: 'key2', dimLabel: 'Landing page', otherLabel: 'Source / medium', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'landing' },
  { key: 'content.landingByCampaign', category: 'content', label: 'Landing pages by campaign', description: 'Where a campaign’s visits land. Add a filter on Campaign to narrow.', report: 'campaign_landing', dim: 'key2', dimLabel: 'Landing page', otherLabel: 'Campaign', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'landing' },
  { key: 'audience.countriesByPage', category: 'audience', label: 'Countries by page', description: 'Where the viewers of a page are. Add a filter on Page to narrow.', report: 'page_country', dim: 'key2', dimLabel: 'Country', otherLabel: 'Page', metrics: PAGE_METRICS, defaultMetric: 'pageviews', charts: RANKED, live: false, drill: 'country' },
  { key: 'audience.countriesBySource', category: 'audience', label: 'Countries by source', description: 'Where visits from a source / medium come from. Add a filter on Source / medium to narrow.', report: 'sm_country', dim: 'key2', dimLabel: 'Country', otherLabel: 'Source / medium', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: RANKED, live: false, drill: 'country' },
  { key: 'audience.devicesByLanding', category: 'audience', label: 'Devices by landing page', description: 'Devices of visits that started on a landing page. Add a filter on Landing page to narrow.', report: 'landing_device', dim: 'key2', dimLabel: 'Device', otherLabel: 'Landing page', metrics: SESSION_METRICS, defaultMetric: 'sessions', charts: ['donut', ...RANKED.filter((c) => c !== 'donut')], live: false, drill: 'device' },
  { key: 'behaviour.eventsByPage', category: 'behaviour', label: 'Events by page', description: 'Events fired on a page. Add a filter on Page to narrow.', report: 'page_event', dim: 'key2', dimLabel: 'Event', otherLabel: 'Page', metrics: ['eventCount', 'users', 'sessions', 'keyEvents'], defaultMetric: 'eventCount', charts: RANKED, live: false, drill: 'event' },
  { key: 'behaviour.eventsBySource', category: 'behaviour', label: 'Events by source', description: 'Events fired by visits from a source / medium. Add a filter on Source / medium to narrow.', report: 'sm_event', dim: 'key2', dimLabel: 'Event', otherLabel: 'Source / medium', metrics: ['eventCount', 'users', 'sessions', 'keyEvents'], defaultMetric: 'eventCount', charts: RANKED, live: false, drill: 'event' },
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

/** The value a ranked row opens when its dataset drills: source / medium rows combine key and sub. */
export function drillValue(ds: Dataset, row: { key: string; sub?: string }): string {
  if (ds.key === 'acquisition.sourceMedium' && row.sub) return `${row.key} / ${row.sub}`;
  return row.key;
}

/** Labels of key1 and key2 as the filter UI shows them: pair datasets name both sides. */
export function keyLabelsFor(ds: Dataset, fallback: string[]): string[] {
  if (!ds.otherLabel) return fallback;
  return ds.dim === 'key1' ? [ds.dimLabel, ds.otherLabel] : [ds.otherLabel, ds.dimLabel];
}
