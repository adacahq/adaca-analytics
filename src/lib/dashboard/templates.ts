/**
 * The six default dashboards. Pure data: seeded on first run, restored by
 * "Reset to template", and offered as starting points for custom boards.
 * Widget ids are stable per template so a reset is deterministic.
 */
import type { WidgetConfig, WidgetInstance, ChartType } from './types';

export interface Template {
  key: string;
  slug: string;
  name: string;
  description: string;
  position: number;
  layout: WidgetInstance[];
}

let counter = 0;
function w(type: ChartType, x: number, y: number, wd: number, h: number, config: WidgetConfig, title?: string): WidgetInstance {
  counter += 1;
  return { id: `t${counter.toString(36).padStart(3, '0')}`, type, title, x, y, w: wd, h, config };
}

const kpi = (x: number, metric: string, title?: string, dataset = 'overview.totals') => w('kpi', x, 0, 3, 2, { dataset, metric, compare: true }, title);

export const TEMPLATES: Template[] = [
  {
    key: 'home',
    slug: 'home',
    name: 'Home',
    description: 'The at-a-glance view: headline figures, the trend, and the top pages, sources and places.',
    position: 0,
    layout: [
      kpi(0, 'users', 'Visitors'),
      kpi(3, 'sessions', 'Visits'),
      kpi(6, 'pageviews', 'Pageviews'),
      kpi(9, 'keyEvents', 'Key events'),
      w('line', 0, 2, 8, 4, { dataset: 'overview.totals', metric: 'users', compare: true }, 'Visitors over time'),
      w('donut', 8, 2, 4, 4, { dataset: 'audience.devices', metric: 'users', limit: 4 }, 'Devices'),
      w('kpi', 0, 6, 3, 2, { dataset: 'overview.totals', metric: 'engagementRate', compare: true }, 'Engagement rate'),
      w('kpi', 3, 6, 3, 2, { dataset: 'overview.totals', metric: 'avgEngagementTime', compare: true }, 'Avg engagement'),
      w('kpi', 6, 6, 3, 2, { dataset: 'overview.totals', metric: 'newUsers', compare: true }, 'New visitors'),
      w('kpi', 9, 6, 3, 2, { dataset: 'overview.totals', metric: 'bounceRate', compare: true }, 'Bounce rate'),
      w('list', 0, 8, 4, 4, { dataset: 'content.pages', metric: 'pageviews', limit: 10 }, 'Top pages'),
      w('list', 4, 8, 4, 4, { dataset: 'content.landing', metric: 'sessions', limit: 10 }, 'Landing pages'),
      w('list', 8, 8, 4, 4, { dataset: 'acquisition.sourceMedium', metric: 'sessions', limit: 10 }, 'Sources'),
      w('list', 0, 12, 4, 4, { dataset: 'acquisition.channels', metric: 'sessions', limit: 8 }, 'Channels'),
      w('list', 4, 12, 4, 4, { dataset: 'audience.countries', metric: 'users', limit: 10 }, 'Countries'),
      w('list', 8, 12, 4, 4, { dataset: 'acquisition.referrers', metric: 'pageviews', limit: 10 }, 'Referrers'),
    ],
  },
  {
    key: 'realtime',
    slug: 'realtime',
    name: 'Realtime',
    description: 'Who is on the site right now: active users by the minute, and what they are looking at.',
    position: 1,
    layout: [
      w('kpi', 0, 0, 3, 3, { dataset: 'realtime.now', metric: 'users' }, 'Active users now'),
      w('column', 3, 0, 9, 3, { dataset: 'realtime.minutes', metric: 'users' }, 'Active users, last 30 minutes'),
      w('list', 0, 3, 4, 4, { dataset: 'realtime.pages', metric: 'users', limit: 10 }, 'Pages being viewed'),
      w('list', 4, 3, 4, 4, { dataset: 'realtime.countries', metric: 'users', limit: 10 }, 'Countries now'),
      w('donut', 8, 3, 4, 4, { dataset: 'realtime.devices', metric: 'users' }, 'Devices now'),
      w('list', 0, 7, 6, 4, { dataset: 'realtime.events', metric: 'eventCount', limit: 10 }, 'Events, last 30 minutes'),
    ],
  },
  {
    key: 'acquisition',
    slug: 'acquisition',
    name: 'Acquisition',
    description: 'Where visits come from: channels, sources and mediums, campaigns and referrers.',
    position: 2,
    layout: [
      kpi(0, 'sessions', 'Visits'),
      kpi(3, 'newUsers', 'New visitors'),
      kpi(6, 'keyEvents', 'Key events'),
      kpi(9, 'keyEventRate', 'Key event rate'),
      w('line', 0, 2, 8, 4, { dataset: 'overview.totals', metric: 'sessions', compare: true }, 'Visits over time'),
      w('donut', 8, 2, 4, 4, { dataset: 'acquisition.channels', metric: 'sessions', limit: 6 }, 'Channels'),
      w('table', 0, 6, 12, 5, { dataset: 'acquisition.sourceMedium', metric: 'sessions', metrics: ['sessions', 'users', 'engagementRate', 'keyEvents'], limit: 25 }, 'Source / medium'),
      w('list', 0, 11, 6, 4, { dataset: 'acquisition.campaigns', metric: 'sessions', limit: 10 }, 'Campaigns'),
      w('list', 6, 11, 6, 4, { dataset: 'acquisition.referrers', metric: 'pageviews', limit: 10 }, 'Referrers'),
    ],
  },
  {
    key: 'content',
    slug: 'content',
    name: 'Content',
    description: 'What people look at: pages, landing pages and titles, with engagement.',
    position: 3,
    layout: [
      kpi(0, 'pageviews', 'Pageviews'),
      kpi(3, 'viewsPerSession', 'Views per visit'),
      kpi(6, 'avgEngagementTime', 'Avg engagement'),
      kpi(9, 'engagedSessions', 'Engaged visits'),
      w('line', 0, 2, 12, 4, { dataset: 'overview.totals', metric: 'pageviews', compare: true }, 'Pageviews over time'),
      w('table', 0, 6, 12, 5, { dataset: 'content.pages', metric: 'pageviews', metrics: ['pageviews', 'users', 'avgEngagementTime', 'keyEvents'], limit: 25 }, 'Pages'),
      w('list', 0, 11, 6, 4, { dataset: 'content.landing', metric: 'sessions', limit: 10 }, 'Landing pages'),
      w('list', 6, 11, 6, 4, { dataset: 'content.titles', metric: 'pageviews', limit: 10 }, 'Page titles'),
    ],
  },
  {
    key: 'audience',
    slug: 'audience',
    name: 'Audience',
    description: 'Who visits: countries and cities, devices, browsers, languages, new against returning.',
    position: 4,
    layout: [
      kpi(0, 'users', 'Visitors'),
      kpi(3, 'newUsers', 'New visitors'),
      kpi(6, 'engagedSessions', 'Engaged visits'),
      kpi(9, 'engagementRate', 'Engagement rate'),
      w('list', 0, 2, 4, 4, { dataset: 'audience.countries', metric: 'users', limit: 10 }, 'Countries'),
      w('list', 4, 2, 4, 4, { dataset: 'audience.cities', metric: 'users', limit: 10 }, 'Cities'),
      w('donut', 8, 2, 4, 4, { dataset: 'audience.devices', metric: 'users', limit: 4 }, 'Devices'),
      w('list', 0, 6, 4, 4, { dataset: 'audience.browsers', metric: 'users', limit: 10 }, 'Browsers'),
      w('list', 4, 6, 4, 4, { dataset: 'audience.os', metric: 'users', limit: 10 }, 'Operating systems'),
      w('donut', 8, 6, 4, 4, { dataset: 'audience.userType', metric: 'users' }, 'New vs returning'),
      w('list', 0, 10, 6, 4, { dataset: 'audience.languages', metric: 'users', limit: 10 }, 'Languages'),
      w('list', 6, 10, 6, 4, { dataset: 'audience.screens', metric: 'users', limit: 10 }, 'Screen resolutions'),
    ],
  },
  {
    key: 'behaviour',
    slug: 'behaviour',
    name: 'Behaviour',
    description: 'What people do: events, key events, and when they visit.',
    position: 5,
    layout: [
      kpi(0, 'eventCount', 'Events'),
      kpi(3, 'keyEvents', 'Key events'),
      kpi(6, 'keyEventRate', 'Key event rate'),
      kpi(9, 'engagedSessions', 'Engaged visits'),
      w('line', 0, 2, 8, 4, { dataset: 'overview.totals', metric: 'keyEvents', compare: true }, 'Key events over time'),
      w('list', 8, 2, 4, 4, { dataset: 'behaviour.keyEvents', metric: 'keyEvents', limit: 10 }, 'Key events'),
      w('table', 0, 6, 12, 5, { dataset: 'behaviour.events', metric: 'eventCount', metrics: ['eventCount', 'users', 'sessions', 'keyEvents'], limit: 25 }, 'Events'),
      w('column', 0, 11, 6, 4, { dataset: 'behaviour.hours', metric: 'sessions' }, 'Visits by hour of day'),
      w('column', 6, 11, 6, 4, { dataset: 'behaviour.weekdays', metric: 'sessions' }, 'Visits by day of week'),
    ],
  },
];

export const TEMPLATE_BY_KEY: Record<string, Template> = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]));

/** A deep copy of a template's layout with fresh ids (for duplicates and new boards). */
export function cloneLayout(layout: WidgetInstance[], genId: () => string): WidgetInstance[] {
  return layout.map((it) => ({ ...it, id: genId(), config: JSON.parse(JSON.stringify(it.config)) as WidgetConfig }));
}
