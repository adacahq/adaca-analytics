# Adaca Analytics

Self-hosted dashboards for Google Analytics 4, running on Cloudflare Workers. Daily
rollups from the GA4 Data API, or from your GA4 BigQuery export, are stored in a D1
database you own. Realtime stays live on Google Analytics. Dashboards are built from
configurable widgets on a drag-and-drop grid.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/adacahq/adaca-analytics)

The GA4 interface answers most questions one report at a time. The screen a team
checks each morning is a dozen of those reports side by side, shaped to that team.
This repository deploys that screen, on infrastructure you control.

## What You Get

- **One button to deploy.**
  The button forks this repository, provisions a D1 database and a KV namespace, asks
  for your Google service-account key, and deploys the Worker with its ingestion cron.
- **Your data, in your account.**
  Rollups live in D1, so dashboards read from your own database and never touch
  Google's API quota. Realtime widgets call Google Analytics live, cached for 30
  seconds.
- **Six dashboards out of the box.**
  Home, Realtime, Acquisition, Content, Audience and Behaviour. Each is a template you
  can customise, reset, or copy into your own.
- **A four-step widget builder.**
  Data type, specific data, chart type, then configure.
- **Several properties as sites.**
  Each site is one GA4 property or one BigQuery export, with its own timezone and
  history. Switch between them from the topbar.
- **BigQuery export support.**
  Read the export instead of the Data API for unsampled numbers and no API quota.
  Google's public GA4 sample dataset works as a try-it-out site.
- **Every number opens.**
  Sources, pages, countries, devices and the rest are detail pages with their own
  trend and breakdowns, precomputed so they load in one round trip.
- **One filter for a whole dashboard.**
  Filter every widget by a source, a page, a country or a channel, save the filter as
  a segment, and share a filtered slice as a read-only link.
- **Reports and alerts.**
  Weekly and monthly summaries, and traffic spike or drop alerts, by email or Slack.
- **No sign-in built in.**
  Put Cloudflare Access or the optional Basic Auth gate in front of it. See
  [Protecting Your Deployment](#3-protecting-your-deployment).

---

## Contents

1. [Before You Deploy: a Google Service Account](#1-before-you-deploy-a-google-service-account)
2. [Deploy to Cloudflare](#2-deploy-to-cloudflare)
3. [Protecting Your Deployment](#3-protecting-your-deployment)
4. [First Run](#4-first-run)
5. [How the Numbers Are Made](#5-how-the-numbers-are-made)
6. [BigQuery Export](#6-bigquery-export)
7. [Dashboards and Widgets](#7-dashboards-and-widgets)
8. [Drill-Down](#8-drill-down)
9. [Period, Comparison and Shortcuts](#9-period-comparison-and-shortcuts)
10. [Filters and Segments](#10-filters-and-segments)
11. [Explore and Export](#11-explore-and-export)
12. [Sharing](#12-sharing)
13. [Reports and Alerts](#13-reports-and-alerts)
14. [Local Development](#14-local-development)
15. [Deploying by Hand](#15-deploying-by-hand)
16. [Architecture](#16-architecture)
17. [Limits and Caveats](#17-limits-and-caveats)
18. [About Adaca](#18-about-adaca)
19. [Licence](#19-licence)

---

## 1. Before You Deploy: a Google Service Account

The app reads Google Analytics as a service account: one JSON key, no OAuth consent
screen, no token that expires. It takes about five minutes in the Google Cloud
console.

1. Open the [Google Cloud console](https://console.cloud.google.com/) and pick or
   create a project.
2. Under **APIs & Services**, open **Library** and enable the **Google Analytics Data
   API** and the **Google Analytics Admin API**. Enable the **BigQuery API** as well if
   you will read an export.
3. Under **IAM & Admin**, open **Service Accounts** and create one. Any name works
   (`adaca-analytics`). No project roles are needed for Google Analytics alone.
4. Open the account, then **Keys**, **Add key**, **Create new key**, **JSON**. The key
   file downloads. Keep it private.
5. In Google Analytics, open **Admin**, then **Property access management**, and add
   the service account's email with the **Viewer** role. The email looks like
   `name@project.iam.gserviceaccount.com`. Repeat for every property you want to see.

For BigQuery, also give the service account **BigQuery Job User** on the project that
will run the queries and **BigQuery Data Viewer** on the export dataset. See
[BigQuery Export](#6-bigquery-export).

## 2. Deploy to Cloudflare

Click the button above. Cloudflare will:

- fork `adacahq/adaca-analytics` into your GitHub account and connect Workers Builds
  to it, so a push to `main` redeploys;
- create the D1 database (`DB`) and the KV namespace (`CACHE`) declared in
  `wrangler.jsonc`;
- prompt for the secrets listed in `.dev.vars.example`: `GOOGLE_SERVICE_ACCOUNT_JSON`,
  which takes the entire contents of the key file as one JSON object, and the optional
  `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` pair described below;
- run `npm run build` and `npm run deploy`, which apply the D1 migrations and deploy
  the Worker with its cron trigger.

When it finishes you get a `*.workers.dev` URL. Open it and the setup wizard starts.

## 3. Protecting Your Deployment

There is no sign-in. Anyone who can reach the URL can see your analytics, so put a
gate in front of it. Either option takes a few minutes.

### Option A: Cloudflare Access

Recommended.

1. In the Cloudflare dashboard open **Zero Trust**, then **Access**, then
   **Applications**, and add a **Self-hosted** application.
2. Set the application domain to your Worker's hostname: the `*.workers.dev` URL, or a
   custom domain you have attached to the Worker.
3. Add an **Allow** policy for emails ending in your domain, for specific emails, or
   for a Google Workspace group.
4. Save. Visitors now sign in through Access before the Worker sees the request.
   Nothing in the app changes.

If an uptime monitor needs to reach `/api/health` without signing in, add a **Bypass**
policy for that path.

### Option B: Built-in HTTP Basic Auth

Set both secrets and the Worker answers every request except `/api/health` with a
browser password prompt:

```
npx wrangler secret put BASIC_AUTH_USERNAME
npx wrangler secret put BASIC_AUTH_PASSWORD
```

Leave both unset, or empty, and the gate is off. One shared credential suits a small
team. Use Access for anything larger.

Every response also carries `X-Robots-Tag: noindex`, and `robots.txt` disallows
everything, so an unprotected deployment at least stays out of search engines.

### Shared Dashboards Pass the Gate

Share links (**More**, then **Share**, on any dashboard; see [Sharing](#12-sharing))
are for people without access. `/share/<token>` and its data route `/api/share/*`
are open by design, together with the client assets under `/_next/*` and the logo and
favicon files. The built-in Basic Auth gate already lets those through, for GET only,
so nothing can be changed through a share URL. With Cloudflare Access, add a
**Bypass** policy for the paths `/share/*`, `/api/share/*`, `/_next/*`, `/logo.svg`,
`/logo-white.svg`, `/favicon.png` and `/apple-touch-icon.png`. Revoking a link closes
it at once.

## 4. First Run

The wizard has four steps.

1. **Credentials.**
   Confirms the secret parses and shows the service-account email to grant access to.
2. **Property.**
   Lists every GA4 property the account can see, or takes a property id typed by hand.
   Choose **BigQuery export only** for a site with no readable GA4 property, such as
   the public sample dataset.
3. **BigQuery.**
   Optional for GA4 properties. Point at the export dataset and the daily rollups come
   from BigQuery instead of the Data API.
4. **Backfill.**
   How much history to pull now: 30, 90, 180 or 365 days.

Creating the site queues a backfill. A progress banner on the dashboard works the
queue from your browser so the backfill completes in minutes, and the cron continues
it if you close the tab. From then on every site is refreshed hourly for its trailing
three days, because Google Analytics settles late data for up to about 72 hours.
**Settings**, then **Ingestion**, lets you refresh or re-backfill on demand.

Add more properties from **Settings**, then **Sites**, then **Add site**, and switch
between them in the topbar.

## 5. How the Numbers Are Made

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
Comparison and Shortcuts](#9-period-comparison-and-shortcuts).

## 6. BigQuery Export

If a property exports to BigQuery (in Google Analytics, **Admin**, then **Product
links**, then **BigQuery links**), the daily rollups can come from the export instead
of the Data API: no sampling and no API quota. BigQuery charges the jobs project only
for the bytes each query scans. Realtime still uses the Google Analytics API.

Grant the service account:

- **BigQuery Job User** on the project that runs the queries. This is the jobs
  project, usually the one the service account belongs to.
- **BigQuery Data Viewer** on the export dataset, or on its project.

In the wizard, enter the jobs project and the dataset as `analytics_<property id>`,
or `project.dataset` for a dataset in another project, and press **Test connection**.
The test lists the day tables it can see. Each report family is one query per 31-day
chunk over `events_*`, intraday tables included.

**Try it without your own export.** Choose **BigQuery export only** in the wizard and
use Google's public sample, `bigquery-public-data.ga4_obfuscated_sample_ecommerce`,
which holds three months of an e-commerce site, from 2020-11-01 to 2021-01-31. Set the
key event to `purchase`. Queries against it run in your jobs project.

BigQuery numbers differ slightly from the Google Analytics interface, which applies
thresholding and modelling the raw export does not. Session-scoped families (visits,
landing pages, sources, channels, geography, devices) attribute a whole session to the
day it started, so a session that crosses midnight counts on its first day, the same
convention GA4 uses. The derivations are documented at the top of
`src/lib/analytics/bq-sql.ts`.

## 7. Dashboards and Widgets

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

## 8. Drill-Down

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
described in [How the Numbers Are Made](#5-how-the-numbers-are-made), and a page is
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

## 9. Period, Comparison and Shortcuts

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

## 10. Filters and Segments

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

## 11. Explore and Export

**See all** on any card, and *top N · see all* on any breakdown of a detail page,
opens `/explore/<dataset>`: every row for the period, up to 500, every metric of the
dataset, a share column on the lead metric, search, column sorting and a **CSV
download**. The page honours the dashboard filter and a widget's own filters, and its
rows drill like a dashboard's.

## 12. Sharing

**More**, then **Share**, on any dashboard creates a read-only link, `/share/<token>`,
for the current site: no rail, no filter control, no drill-down, nothing to change. A
link can **lock the period** to the current one and **pin the current filter**, which
is how a slice of the data is shared without the rest. Otherwise the reader chooses
the period. **Embed** gives an `<iframe>` snippet (`?embed=1` hides the bar). Revoke a
link and it stops resolving at once. Widgets on a shared page load through
`/api/share/<token>/widget`, which serves that dashboard for that site and nothing
else. See [Protecting Your Deployment](#3-protecting-your-deployment) for what the
gate lets through.

## 13. Reports and Alerts

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

## 14. Local Development

```
git clone https://github.com/adacahq/adaca-analytics
cd adaca-analytics
npm install
cp .dev.vars.example .dev.vars     # paste your service-account JSON on one line
npm run types                      # generate worker-configuration.d.ts
npm run db:migrate                 # apply migrations to the local D1
npm run dev                        # http://localhost:3000
```

`vinext dev` runs the app inside workerd through the Cloudflare Vite plugin, so D1 and
KV are real local bindings, with state under `.wrangler/state`. Fire the cron by hand:

```
curl 'http://localhost:3000/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*'
```

Four gates run in CI: `npm run build`, the authoritative check of the app graph;
`npm run typecheck`; `npm run lint`; and `npm test`. The BigQuery SQL has a live test
against the public sample dataset that runs only when you point it at a key:

```
GOOGLE_SA_KEY_FILE=~/.secrets/my-service-account.json npm test
```

## 15. Deploying by Hand

```
npx wrangler login
export CLOUDFLARE_ACCOUNT_ID=<account id>   # pin the account
npx wrangler d1 create adaca-analytics       # once; paste the id into wrangler.jsonc
npx wrangler kv namespace create CACHE       # once; paste the id into wrangler.jsonc
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npm run deploy                               # build, apply migrations, deploy
```

`npm run deploy` runs `vinext build`, then `wrangler d1 migrations apply DB --remote`,
then `wrangler deploy` with the generated config in `dist/server/wrangler.json`.

## 16. Architecture

- **vinext** (the Next.js App Router API surface on Vite), React 19 and Tailwind v4,
  built and served by a Cloudflare Worker. `worker/index.ts` wraps vinext's fetch
  handler to add the cron handler and the optional Basic Auth gate.
- **D1** holds `sites`, `dashboards` (widget layouts as JSON), `rollups` (the fact
  table, composite key `site · report · date · key1 · key2`, with a reverse index on
  `key2` so both directions of a pair family are fast), `ingest_runs`, `segments`
  (saved filters), `shares` (share links), `reports` (scheduled deliveries) and
  `settings`. Migrations live in `migrations/`.
- **KV** caches Google access tokens for 55 minutes, realtime reports for 30 seconds,
  exact-uniques lookups for 10 minutes, and the property list.
- **Ingestion** is bounded-unit pumping. A run is cut into units, one report family by
  one chunk of at most 31 days, each small enough for any invocation budget. The cron
  ticks every 15 minutes, and the browser calls `/api/ingest/advance` while a run is
  active.
- **The query engine** turns widget config and period into parameterised SQL over
  `rollups`, or a live Google Analytics realtime call, and returns render-ready shapes
  (`kpi`, `timeseries`, `ranked`, `table`). Detail pages go through
  `src/lib/analytics/drill.ts`, which batches every statement for a page into one D1
  call; `entities.ts` is the registry of entity kinds and their breakdowns;
  `segments.ts` resolves a dataset under the dashboard filter to the family and keys
  that answer it. Explore pages (`/explore/<dataset>`) run the same engine as a
  500-row table.
- **Sharing and reports.** `/share/<token>` renders a dashboard read-only outside the
  app shell, fed by `/api/share/<token>/widget`; `src/lib/gate.ts` is the one rule for
  what the Basic Auth gate lets through. `src/lib/reports/` builds the weekly and
  monthly summaries and the alerts, delivers them (Resend, Slack webhooks) and runs
  from the cron tick after the ingestion pump.
- **The design system** is Canvas, shared with Adaca's other apps. `src/app/globals.css`
  is the single source of truth. See `docs/design-system.md`.

## 17. Limits and Caveats

- **D1 storage.** A database on the Workers Free plan holds 500 MB, and 10 GB on
  Workers Paid. A busy site writes roughly 5,000 single-dimension rollup rows a day,
  about 1 MB. With drill-down on, the pair families add up to 25,000 rows a day on a
  very large site (the 1,500-per-family cap) and a few hundred on a small one. A year
  of a small site fits the free plan with drill-down on; a large site wants the paid
  plan, or drill-down switched off for it.
- **GA4 Data API quota.** A backfill is about 37 requests per site per 31 days of
  history with drill-down on (20 without), and the hourly refresh is the same per
  tick, well inside the standard quota.
- **Realtime** needs a GA4 property. BigQuery-only sites have no realtime view.
- **Screen resolutions** are not in the BigQuery export, so that dataset stays empty
  for BigQuery-fed sites.
- **Timezones.** Rollup dates are in the property's reporting timezone, read from
  Google Analytics at setup and editable per site. "Today" is today there.
- **One filter at a time.** Two conditions together (source and country) would need
  three-dimension rollups, which are not stored. A widget whose dimension has no pair
  with the filter's says so. Filters on city, OS, browser, language, screen, visitor
  type, hour, region, ad content, term, OS version and hostname narrow totals and
  trends only.
- **Hours exist for site-wide totals only.** Every other family is daily, so there is
  no "last 24 hours" period and no hourly breakdown by page or source.
- **Drop alerts** depend on the hourly refresh. They check only while the site was
  ingested up to yesterday or today.

## 18. About Adaca

Adaca is a software consultancy. We build custom software, embed senior engineers in
client teams, and put AI to work across Australia and New Zealand. Adaca Analytics is
open-source software we maintain and release under the MIT licence.

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## 19. Licence

MIT. See [LICENSE](LICENSE).
