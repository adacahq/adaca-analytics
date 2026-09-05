/**
 * The entity registry — what a drill-down page is. An entity is one value of
 * one dimension (the source "google", the page "/pricing", the country
 * "Australia"); its page shows the entity's own totals and trend from the
 * single-dimension family that carries it, plus **breakdowns** read from the
 * precomputed pair families. Pure data + pure functions; the SQL builders in
 * `query-sql.ts` and the loader in `drill.ts` read this one registry.
 */
import type { MetricKey } from './metrics';
import type { ReportKey, SingleKey } from './reports';

export type EntityKind =
  | 'source'
  | 'sourceMedium'
  | 'medium'
  | 'channel'
  | 'campaign'
  | 'referrer'
  | 'page'
  | 'title'
  | 'landing'
  | 'country'
  | 'city'
  | 'device'
  | 'os'
  | 'browser'
  | 'language'
  | 'screen'
  | 'userType'
  | 'event'
  | 'hour';

/**
 * How an entity's value matches a stored key:
 *  - `eq`            the key is the value
 *  - `source`        the key is "source / medium" and the value is the source   (LIKE 'v / %')
 *  - `medium`        the key is "source / medium" and the value is the medium   (LIKE '% / v')
 *  - `sourceMedium`  the family stores source in key1 and medium in key2 and
 *                    the value is the combined "source / medium" string
 */
export type Match = 'eq' | 'source' | 'medium' | 'sourceMedium';
export type KeySide = 'key1' | 'key2';

export interface Breakdown {
  label: string;
  /** The family read — a pair family, or a single family whose other key is a sub-dimension. */
  family: ReportKey;
  /** The side of the family that holds this entity's value; the other side is ranked. */
  side: KeySide;
  match: Match;
  /** The entity kind each ranked row opens, or null when the value is not itself an entity. */
  linkTo: EntityKind | null;
  metric: MetricKey;
  /** Header of the ranked dimension. */
  dimLabel: string;
}

export interface EntityDef {
  kind: EntityKind;
  label: string;
  plural: string;
  /** Where the entity's own totals and trend come from. */
  family: SingleKey;
  side: KeySide;
  match: Match;
  /** Paths and hosts render in the mono face. */
  mono: boolean;
  /** The metric that leads the page: its trend, and its share of the site. */
  lead: MetricKey;
  kpis: MetricKey[];
  breakdowns: Breakdown[];
}

const SESSION_KPIS: MetricKey[] = ['sessions', 'users', 'engagementRate', 'avgEngagementTime', 'pageviews', 'keyEvents', 'keyEventRate'];
const PAGE_KPIS: MetricKey[] = ['pageviews', 'users', 'sessions', 'avgEngagementTime', 'keyEvents', 'eventCount'];
const EVENT_KPIS: MetricKey[] = ['eventCount', 'users', 'sessions', 'keyEvents'];

/** The breakdowns every traffic-source entity gets, matched on the stored "source / medium". */
function trafficBreakdowns(match: Match): Breakdown[] {
  return [
    { label: 'Landing pages', family: 'sm_landing', side: 'key1', match, linkTo: 'landing', metric: 'sessions', dimLabel: 'Landing page' },
    { label: 'Pages', family: 'sm_page', side: 'key1', match, linkTo: 'page', metric: 'pageviews', dimLabel: 'Page' },
    { label: 'Countries', family: 'sm_country', side: 'key1', match, linkTo: 'country', metric: 'sessions', dimLabel: 'Country' },
    { label: 'Devices', family: 'sm_device', side: 'key1', match, linkTo: 'device', metric: 'sessions', dimLabel: 'Device' },
    { label: 'Events', family: 'sm_event', side: 'key1', match, linkTo: 'event', metric: 'eventCount', dimLabel: 'Event' },
    { label: 'Channels', family: 'channel_sm', side: 'key2', match, linkTo: 'channel', metric: 'sessions', dimLabel: 'Channel' },
  ];
}

export const ENTITIES: EntityDef[] = [
  {
    kind: 'source',
    label: 'Source',
    plural: 'Sources',
    family: 'source',
    side: 'key1',
    match: 'eq',
    mono: false,
    lead: 'sessions',
    kpis: SESSION_KPIS,
    breakdowns: [
      { label: 'Mediums', family: 'source', side: 'key1', match: 'eq', linkTo: 'medium', metric: 'sessions', dimLabel: 'Medium' },
      ...trafficBreakdowns('source'),
      { label: 'Campaigns', family: 'campaign', side: 'key2', match: 'eq', linkTo: 'campaign', metric: 'sessions', dimLabel: 'Campaign' },
    ],
  },
  {
    kind: 'medium',
    label: 'Medium',
    plural: 'Mediums',
    family: 'source',
    side: 'key2',
    match: 'eq',
    mono: false,
    lead: 'sessions',
    kpis: SESSION_KPIS,
    breakdowns: [
      { label: 'Sources', family: 'source', side: 'key2', match: 'eq', linkTo: 'source', metric: 'sessions', dimLabel: 'Source' },
      ...trafficBreakdowns('medium'),
    ],
  },
  {
    kind: 'sourceMedium',
    label: 'Source / medium',
    plural: 'Sources / mediums',
    family: 'source',
    side: 'key1',
    match: 'sourceMedium',
    mono: false,
    lead: 'sessions',
    kpis: SESSION_KPIS,
    breakdowns: trafficBreakdowns('eq'),
  },
  {
    kind: 'channel',
    label: 'Channel',
    plural: 'Channels',
    family: 'channel',
    side: 'key1',
    match: 'eq',
    mono: false,
    lead: 'sessions',
    kpis: SESSION_KPIS,
    breakdowns: [
      { label: 'Sources', family: 'channel_sm', side: 'key1', match: 'eq', linkTo: 'sourceMedium', metric: 'sessions', dimLabel: 'Source / medium' },
      { label: 'Landing pages', family: 'channel_landing', side: 'key1', match: 'eq', linkTo: 'landing', metric: 'sessions', dimLabel: 'Landing page' },
      { label: 'Pages', family: 'channel_page', side: 'key1', match: 'eq', linkTo: 'page', metric: 'pageviews', dimLabel: 'Page' },
      { label: 'Countries', family: 'channel_country', side: 'key1', match: 'eq', linkTo: 'country', metric: 'sessions', dimLabel: 'Country' },
    ],
  },
  {
    kind: 'campaign',
    label: 'Campaign',
    plural: 'Campaigns',
    family: 'campaign',
    side: 'key1',
    match: 'eq',
    mono: false,
    lead: 'sessions',
    kpis: SESSION_KPIS,
    breakdowns: [
      { label: 'Landing pages', family: 'campaign_landing', side: 'key1', match: 'eq', linkTo: 'landing', metric: 'sessions', dimLabel: 'Landing page' },
      { label: 'Sources', family: 'campaign', side: 'key1', match: 'eq', linkTo: 'source', metric: 'sessions', dimLabel: 'Source' },
    ],
  },
  {
    kind: 'referrer',
    label: 'Referrer',
    plural: 'Referrers',
    family: 'referrer',
    side: 'key1',
    match: 'eq',
    mono: true,
    lead: 'pageviews',
    kpis: PAGE_KPIS,
    breakdowns: [{ label: 'Pages', family: 'referrer_page', side: 'key1', match: 'eq', linkTo: 'page', metric: 'pageviews', dimLabel: 'Page' }],
  },
  {
    kind: 'page',
    label: 'Page',
    plural: 'Pages',
    family: 'page',
    side: 'key1',
    match: 'eq',
    mono: true,
    lead: 'pageviews',
    kpis: PAGE_KPIS,
    breakdowns: [
      { label: 'Sources', family: 'sm_page', side: 'key2', match: 'eq', linkTo: 'sourceMedium', metric: 'pageviews', dimLabel: 'Source / medium' },
      { label: 'Channels', family: 'channel_page', side: 'key2', match: 'eq', linkTo: 'channel', metric: 'pageviews', dimLabel: 'Channel' },
      { label: 'Referrers', family: 'referrer_page', side: 'key2', match: 'eq', linkTo: 'referrer', metric: 'pageviews', dimLabel: 'Referrer' },
      { label: 'Countries', family: 'page_country', side: 'key1', match: 'eq', linkTo: 'country', metric: 'pageviews', dimLabel: 'Country' },
      { label: 'Devices', family: 'page_device', side: 'key1', match: 'eq', linkTo: 'device', metric: 'pageviews', dimLabel: 'Device' },
      { label: 'Events on this page', family: 'page_event', side: 'key1', match: 'eq', linkTo: 'event', metric: 'eventCount', dimLabel: 'Event' },
      { label: 'Titles', family: 'page', side: 'key1', match: 'eq', linkTo: 'title', metric: 'pageviews', dimLabel: 'Title' },
    ],
  },
  {
    kind: 'title',
    label: 'Page title',
    plural: 'Page titles',
    family: 'page',
    side: 'key2',
    match: 'eq',
    mono: false,
    lead: 'pageviews',
    kpis: PAGE_KPIS,
    breakdowns: [{ label: 'Pages', family: 'page', side: 'key2', match: 'eq', linkTo: 'page', metric: 'pageviews', dimLabel: 'Page' }],
  },
  {
    kind: 'landing',
    label: 'Landing page',
    plural: 'Landing pages',
    family: 'landing',
    side: 'key1',
    match: 'eq',
    mono: true,
    lead: 'sessions',
    kpis: SESSION_KPIS,
    breakdowns: [
      { label: 'Sources', family: 'sm_landing', side: 'key2', match: 'eq', linkTo: 'sourceMedium', metric: 'sessions', dimLabel: 'Source / medium' },
      { label: 'Channels', family: 'channel_landing', side: 'key2', match: 'eq', linkTo: 'channel', metric: 'sessions', dimLabel: 'Channel' },
      { label: 'Campaigns', family: 'campaign_landing', side: 'key2', match: 'eq', linkTo: 'campaign', metric: 'sessions', dimLabel: 'Campaign' },
      { label: 'Countries', family: 'landing_country', side: 'key1', match: 'eq', linkTo: 'country', metric: 'sessions', dimLabel: 'Country' },
      { label: 'Devices', family: 'landing_device', side: 'key1', match: 'eq', linkTo: 'device', metric: 'sessions', dimLabel: 'Device' },
    ],
  },
  {
    kind: 'country',
    label: 'Country',
    plural: 'Countries',
    family: 'geo',
    side: 'key1',
    match: 'eq',
    mono: false,
    lead: 'sessions',
    kpis: SESSION_KPIS,
    breakdowns: [
      { label: 'Cities', family: 'geo', side: 'key1', match: 'eq', linkTo: 'city', metric: 'sessions', dimLabel: 'City' },
      { label: 'Pages', family: 'page_country', side: 'key2', match: 'eq', linkTo: 'page', metric: 'pageviews', dimLabel: 'Page' },
      { label: 'Landing pages', family: 'landing_country', side: 'key2', match: 'eq', linkTo: 'landing', metric: 'sessions', dimLabel: 'Landing page' },
      { label: 'Sources', family: 'sm_country', side: 'key2', match: 'eq', linkTo: 'sourceMedium', metric: 'sessions', dimLabel: 'Source / medium' },
      { label: 'Channels', family: 'channel_country', side: 'key2', match: 'eq', linkTo: 'channel', metric: 'sessions', dimLabel: 'Channel' },
      { label: 'Devices', family: 'country_device', side: 'key1', match: 'eq', linkTo: 'device', metric: 'sessions', dimLabel: 'Device' },
    ],
  },
  {
    kind: 'city',
    label: 'City',
    plural: 'Cities',
    family: 'geo',
    side: 'key2',
    match: 'eq',
    mono: false,
    lead: 'sessions',
    kpis: SESSION_KPIS,
    breakdowns: [{ label: 'Countries', family: 'geo', side: 'key2', match: 'eq', linkTo: 'country', metric: 'sessions', dimLabel: 'Country' }],
  },
  {
    kind: 'device',
    label: 'Device',
    plural: 'Devices',
    family: 'device',
    side: 'key1',
    match: 'eq',
    mono: false,
    lead: 'sessions',
    kpis: SESSION_KPIS,
    breakdowns: [
      { label: 'Operating systems', family: 'device', side: 'key1', match: 'eq', linkTo: 'os', metric: 'sessions', dimLabel: 'OS' },
      { label: 'Pages', family: 'page_device', side: 'key2', match: 'eq', linkTo: 'page', metric: 'pageviews', dimLabel: 'Page' },
      { label: 'Landing pages', family: 'landing_device', side: 'key2', match: 'eq', linkTo: 'landing', metric: 'sessions', dimLabel: 'Landing page' },
      { label: 'Sources', family: 'sm_device', side: 'key2', match: 'eq', linkTo: 'sourceMedium', metric: 'sessions', dimLabel: 'Source / medium' },
      { label: 'Countries', family: 'country_device', side: 'key2', match: 'eq', linkTo: 'country', metric: 'sessions', dimLabel: 'Country' },
    ],
  },
  {
    kind: 'os',
    label: 'Operating system',
    plural: 'Operating systems',
    family: 'device',
    side: 'key2',
    match: 'eq',
    mono: false,
    lead: 'sessions',
    kpis: SESSION_KPIS,
    breakdowns: [{ label: 'Devices', family: 'device', side: 'key2', match: 'eq', linkTo: 'device', metric: 'sessions', dimLabel: 'Device' }],
  },
  { kind: 'browser', label: 'Browser', plural: 'Browsers', family: 'browser', side: 'key1', match: 'eq', mono: false, lead: 'sessions', kpis: SESSION_KPIS, breakdowns: [] },
  { kind: 'language', label: 'Language', plural: 'Languages', family: 'language', side: 'key1', match: 'eq', mono: false, lead: 'sessions', kpis: SESSION_KPIS, breakdowns: [] },
  { kind: 'screen', label: 'Screen resolution', plural: 'Screen resolutions', family: 'screen', side: 'key1', match: 'eq', mono: true, lead: 'sessions', kpis: SESSION_KPIS, breakdowns: [] },
  { kind: 'userType', label: 'Visitor type', plural: 'Visitor types', family: 'user_type', side: 'key1', match: 'eq', mono: false, lead: 'sessions', kpis: SESSION_KPIS, breakdowns: [] },
  {
    kind: 'event',
    label: 'Event',
    plural: 'Events',
    family: 'event',
    side: 'key1',
    match: 'eq',
    mono: true,
    lead: 'eventCount',
    kpis: EVENT_KPIS,
    breakdowns: [
      { label: 'Pages', family: 'page_event', side: 'key2', match: 'eq', linkTo: 'page', metric: 'eventCount', dimLabel: 'Page' },
      { label: 'Sources', family: 'sm_event', side: 'key2', match: 'eq', linkTo: 'sourceMedium', metric: 'eventCount', dimLabel: 'Source / medium' },
    ],
  },
  { kind: 'hour', label: 'Hour of day', plural: 'Hours', family: 'hour', side: 'key1', match: 'eq', mono: false, lead: 'sessions', kpis: SESSION_KPIS, breakdowns: [] },
];

export const ENTITY_BY_KIND: Record<EntityKind, EntityDef> = Object.fromEntries(ENTITIES.map((e) => [e.kind, e])) as Record<EntityKind, EntityDef>;

export function isEntityKind(k: unknown): k is EntityKind {
  return typeof k === 'string' && k in ENTITY_BY_KIND;
}

/** "google / organic" → ["google", "organic"]; a value without the separator is a bare source. */
export function splitSourceMedium(value: string): [string, string | null] {
  const i = value.indexOf(' / ');
  return i === -1 ? [value, null] : [value.slice(0, i), value.slice(i + 3)];
}

/** The URL of an entity page; `query` is the period query to carry along. */
export function entityHref(kind: EntityKind, value: string, query?: string): string {
  const base = `/detail/${kind}/${encodeURIComponent(value)}`;
  return query ? `${base}?${query}` : base;
}

/** Display label for stored values that stand in for "nothing". */
export function entityTitle(kind: EntityKind, value: string): string {
  if (value === '') return '(not set)';
  if (kind === 'userType') return value === 'new' ? 'New visitors' : value === 'returning' ? 'Returning visitors' : value;
  if (kind === 'hour' && /^\d{2}$/.test(value)) return `${value}:00`;
  return value;
}
