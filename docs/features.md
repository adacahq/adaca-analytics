# Features

What Adaca Analytics shows and how it is made. For deploying and running it, see
[Operations](operations.md); for how it is built, [Architecture](architecture.md).

## How the Numbers Are Made


Every site is ingested into the same twenty report families, one row per day per
dimension value.

| Family | Dimensions | Feeds |
|---|---|---|
| `totals` | none | the headline numbers and time series |
| `page` | page path, title | Pages viewed, Page titles |
| `landing` | landing page | Landing pages |
| `source` | source, medium | Sources, Mediums, Source / medium |
| `channel` | default channel group | Channels |
| `campaign` | campaign, source | Campaigns |
| `referrer` | referring host | Referrers |
| `geo` | country, city | Countries, Cities |
| `device` | device category, OS | Devices, Operating systems |
| `browser`, `language`, `screen` | one each | Browsers, Languages, Screen resolutions |
| `user_type` | new or returning | New vs returning |
| `event` | event name, is key event | Events, Key events |
| `hour` | hour of day | Hour of day (day of week comes from `totals`), and the hourly trend of Today and Yesterday |
| `region` | country, region | Regions |
| `utm_content`, `utm_term` | ad content or term, campaign | Ad content, Terms |
| `os_version` | OS, version | OS versions |
| `host` | hostname | Hostnames |

Sites with drill-down on, the default, are also ingested into seventeen pair
families, two dimensions per row, which power the detail pages and the "by" datasets
in the builder: source / medium by landing page, page, country, device and event;
channel by source / medium, landing page, page and country; campaign by landing page;
referrer by page; page by country, device and event; landing page by country and
device; and country by device. Source and medium travel as GA4's combined
`source / medium` string, so a source page filters `google / %` and a medium page
`% / organic`.

A site backfilled before a family existed shows **Add N new reports** on **Settings**,
then **Ingestion**, which ingests only the missing families over the days the site
already holds.

Each row stores eight metrics: users, new users, sessions, engaged sessions, pageviews,
engagement seconds, key events and event count. Widgets sum them over the chosen
period. Ratios (engagement rate, bounce rate, average engagement time, views per
visit, key-event rate) are computed from the sums and never averaged per day, which
would weight a quiet day the same as a busy one.

**Visitors are the one exception.** Daily unique visitors summed over a range count
anyone who came back on another day more than once. For the site-wide **Visitors** and
**New visitors** tiles on a site with a GA4 property, the app asks Google Analytics for
the exact figure over the period, cached for ten minutes, so the tile matches the GA4
interface. Visitor counts inside breakdowns, by country or by page, are sums of daily
uniques. Read them as visitor-days.

In the app, **visits** are GA4 sessions and **key events** are whatever the property
marks as key events, GA4's name for conversions. The **Period** control in the topbar
is stored in the URL, so a dashboard link reproduces the view; see [Period,
Comparison and Shortcuts](#period-comparison-and-shortcuts).

## Dashboards and Widgets


- **Customise** puts a dashboard into edit mode: drag by the handle, resize from the
  corner, edit, copy or remove any widget, **Add widget**, then **Done**.
- **Add widget** walks four steps: the data type (Overview, Realtime, Acquisition,
  Content, Audience, Behaviour, or a Note), the specific data (Pages viewed, for
  example), the chart type the data supports (Number, Line, Columns, Bars, Donut,
  Ranked list, Table), then configure: title, metric, rows, sort, filters, grouping
  and comparison.
- **More** on any dashboard offers **Reset to template** for the default dashboards,
  **Duplicate** for any dashboard, and **Rename** and **Delete** for custom ones.
- **New dashboard** in the rail starts blank or from any of the six templates.

Dashboards are shared by everyone who can open the deployment. There are no user
accounts. **Settings**, then **Appearance**, picks the chart palette for everyone:
blue by default, or red, yellow, green, orange or purple. Light and dark stay each
reader's own choice, in the topbar.

**On a phone or tablet** the same dashboards reflow rather than shrink. Below 900px
the rail becomes a drawer behind the menu button, the site picker moves to the foot of
that drawer, and widgets fall into two columns, with charts spanning both. Below 640px
KPI tiles form a compact strip, charts get a phone-sized plot, lists grow to their
rows, tables scroll sideways inside their card, and the settings tables become card
lists. **Customise** still works: drag gives way to move up and move down, and the
widget builder opens as a bottom sheet whose footer stays put while the form scrolls.
Every tap target is at least 40px on touch screens.

## Drill-Down


Almost every value on a dashboard opens: a source, a page, a landing page, a channel,
a campaign, a referrer, a country, a city, a device, an OS, an event. Ranked-list rows,
table cells, bars, columns, donut sectors, the legend entries and axis labels beside
them, and KPI tiles narrowed to one value by an exact filter are all links to
`/detail/<kind>/<value>`, carrying the dashboard's period along. Marks over time work
the other way: a click on a day, week or month in a line or column chart, or on its
date label, narrows the page to that span, on dashboards and on detail pages alike.
Every clickable mark says so in its tooltip and takes the pointer. The few that cannot
open anything (day-of-week columns, realtime minutes, site-wide totals) stay plain.
On a touch screen a chart mark takes two taps: the first shows its tooltip, since
there is no hover to do that, and the second opens it. Rows, tiles and labels open on
one tap.

A detail page shows, for the chosen period and the one compared with it:

- the entity's **KPIs** with deltas (visits, visitors, engagement rate, average
  engagement time, pageviews, key events, key-event rate; pageviews-led for pages and
  referrers, events-led for events) and its **share of the site**;
- a **trend** of the lead metric, with the compared period dashed behind it;
- **breakdowns**. For a source: landing pages, pages, countries, devices, events,
  channels, mediums and campaigns. For a page: sources, channels, referrers,
  countries, devices, events on the page and titles. For a country: regions, cities,
  pages, landing pages, sources, channels and devices. And so on. Every breakdown row
  opens its own page, so you can walk from `google / organic` to the landing page it
  sends people to, to the countries they come from, without leaving precomputed data.

Everything on a detail page is **precomputed**. The breakdowns read the pair families
described in [How the Numbers Are Made](#how-the-numbers-are-made), and a page is
one D1 round trip of about ten statements, tens of milliseconds. No Google call is made
on the way. To keep storage bounded on large sites, each pair family keeps the top
**1,500** combinations per day, by visits, or by events for event-level pairs, and
folds the rest into one `(other)` row, so totals and shares still add up exactly.
Sites the size of a company website never reach the cap.

Existing sites: **Settings**, then **Ingestion**, then **Add drill-down data**,
ingests the pair families over the days the site already holds, without re-pulling the
single-dimension rollups. New sites get them with their first backfill. The per-site
**Drill-down** switch in **Settings**, then **Sites**, turns the pairs off for
deployments that must stay inside the free D1 plan. Existing rows are kept.

The pair families are also builder datasets: Pages by source, Sources by page, Landing
pages by channel, Events by page, Countries by source, Devices by landing page, and
more. A filter on the other dimension narrows them ("Pages by source" with *Source /
medium is google / organic*).

## Period, Comparison and Shortcuts


The **Period** control offers Today, Yesterday, the last 7, 28 or 90 days, this month,
last month, year to date, the last 12 months, all time (from the site's first day) and
a custom span. Every preset has a one-letter shortcut, shown beside it: D, E, W, T, Q,
M, P, Y, L and A. X toggles the comparison and C opens the custom fields. **Compare**
puts a second window behind every widget: the period before, the default; the same
dates a year earlier; or any window you choose. Deltas and dashed lines follow, and
every caption says which ("vs prev", "vs last year", "vs period"). The URL carries
all of it (`?range=7d&compare=yoy`, `?from=…&to=…&compare=2025-08-01..2025-08-28`),
so a link reproduces the view.

Site-wide totals over a day or two chart **by the hour**. Today and Yesterday show an
hourly line, today up to the current hour, read from the hour-of-day family the site
already holds. A widget can also ask for hours in **Group by**. The **live count** in
the topbar, people on the site in the last 30 minutes, is on every desktop screen and
opens the Realtime dashboard.

## Filters and Segments


**Filter** in the topbar applies one condition to a whole dashboard: a dimension
(source, medium, source / medium, channel, campaign, referrer, page, landing page,
country, device, event, and any other entity kind, for totals and trends), an
operator (is, is not, contains, does not contain) and a value, with suggestions from
the site's own data. It lives in the URL (`?seg=source:eq:google`) so links keep it,
and **Save as segment** keeps it by name for everyone on the deployment.

Segments are served from stored rollups, never a live call. Totals, KPI tiles and
trends read the segment's own family, so they are exact. A ranked widget follows the
filter when its dimension is stored together with the filter's: on its own family
(Sources under a medium filter, Pages under a title filter, Countries under a city
filter) or on a pair family (Landing pages under a channel filter reads channel by
landing page; Sources under a landing-page filter reads source / medium by landing
page and splits the source out). A widget with no stored pair for the combination
says so in place of its numbers ("Channel is not stored together with referrer")
rather than showing unfiltered data. Realtime widgets are never filtered and say so in
their caption. The site-wide Visitors tile stays exact under a filter: the same GA4
lookup carries the filter as a dimension filter. Detail pages ignore the filter, as
they are already one dimension, and say so.

## Explore and Export


**See all** on any card, and *top N · see all* on any breakdown of a detail page,
opens `/explore/<dataset>`: every row for the period, up to 500, every metric of the
dataset, a share column on the lead metric, search, column sorting and a **CSV
download**. The page honours the dashboard filter and a widget's own filters, and its
rows drill like a dashboard's.

## Sharing


**More**, then **Share**, on any dashboard creates a read-only link, `/share/<token>`,
for the current site: no rail, no filter control, no drill-down, nothing to change. A
link can **lock the period** to the current one and **pin the current filter**, which
is how a slice of the data is shared without the rest. Otherwise the reader chooses
the period. **Embed** gives an `<iframe>` snippet (`?embed=1` hides the bar). Revoke a
link and it stops resolving at once. Widgets on a shared page load through
`/api/share/<token>/widget`, which serves that dashboard for that site and nothing
else. See [Protecting Your Deployment](operations.md#protecting-your-deployment) for what the
gate lets through.

## Reports and Alerts


**Settings**, then **Reports**, schedules deliveries by **email** or to a **Slack**
channel:

- **Weekly summary.** Every Monday after 08:00 site time: last week's visitors, visits,
  pageviews, engagement rate, average engagement time and key events with deltas
  against the week before, the top pages, sources and countries, and a link to the
  dashboard for that period.
- **Monthly summary.** The same on the 1st, for the month before.
- **Traffic spike alert.** When the live visitor count reaches a threshold, at most
  once every 12 hours.
- **Traffic drop alert.** When visits in the last 12 hours fall below a threshold,
  from the hourly family the refresh keeps current; checked hourly, at most once every
  12 hours.

The cron delivers them; nothing needs to be open. **Send now** delivers a report at
once, which is how to check a channel works, and each report shows its last delivery
or error. Slack needs only an incoming-webhook URL. Email goes through
[Resend](https://resend.com). Set two secrets and the email channel switches on:

```
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put REPORT_FROM     # a sender on a domain verified in Resend
```

Links in reports use the address the app was last opened at.
