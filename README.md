# Adaca Analytics

Self-hosted dashboards for **Google Analytics 4**, running on **Cloudflare Workers**.
It pulls daily rollups from the GA4 Data API (or from your GA4 **BigQuery export**)
into a D1 database you own, keeps GA's realtime view live, and lets you build any
dashboard from configurable widgets — numbers, lines, bars, donuts, ranked lists,
tables and notes — on a drag-and-drop grid.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/adacahq/adaca-analytics)

- **One click to deploy.** The button forks this repo, provisions a D1 database and a
  KV namespace, asks for your Google service-account key, and deploys the Worker with
  its hourly refresh cron.
- **Your data, in your account.** Rollups live in D1; dashboards load in milliseconds
  and never touch GA's API quota. Realtime widgets call GA live, cached for 30 seconds.
- **Six dashboards out of the box** — Home, Realtime, Acquisition, Content, Audience,
  Behaviour — each a template you can customise, reset, or copy into your own.
- **A four-step widget builder**: data type → specific data → chart type → configure.
- **Multiple properties** as "sites", switchable from the topbar, each with its own
  timezone and history.
- **BigQuery export support**, including Google's public GA4 sample dataset as a
  try-it-out site.
- **No sign-in built in.** See [Protecting your deployment](#protecting-your-deployment).

---

## Contents

1. [Before you deploy: a Google service account](#1-before-you-deploy-a-google-service-account)
2. [Deploy to Cloudflare](#2-deploy-to-cloudflare)
3. [Protecting your deployment](#protecting-your-deployment)
4. [First run](#3-first-run)
5. [How the numbers are made](#how-the-numbers-are-made)
6. [BigQuery export](#bigquery-export)
7. [Dashboards and widgets](#dashboards-and-widgets)
8. [Drill-down](#drill-down)
9. [Period, comparison and shortcuts](#period-comparison-and-shortcuts)
10. [Filters and segments](#filters-and-segments)
11. [Explore and export](#explore-and-export)
12. [Sharing](#sharing)
13. [Reports and alerts](#reports-and-alerts)
14. [Local development](#local-development)
15. [Deploying by hand](#deploying-by-hand)
16. [Architecture](#architecture)
17. [Limits and caveats](#limits-and-caveats)

---

## 1. Before you deploy: a Google service account

The app reads Google Analytics as a **service account** — one JSON key, no OAuth
consent screens, no tokens that expire. Five minutes in the Google Cloud console:

1. Open [Google Cloud console](https://console.cloud.google.com/) and pick (or create)
   a project.
2. **APIs & Services → Library**: enable the **Google Analytics Data API** and the
   **Google Analytics Admin API**. (Enable the **BigQuery API** too if you will read
   an export.)
3. **IAM & Admin → Service Accounts → Create service account**. Name it anything
   (`adaca-analytics`). No project roles are needed for GA alone.
4. Open the account → **Keys → Add key → Create new key → JSON**. The key file
   downloads; keep it private.
5. In **Google Analytics → Admin → Property → Property access management**, add the
   service account's email (it looks like `name@project.iam.gserviceaccount.com`) with
   the **Viewer** role. Repeat for every property you want to see.

For BigQuery, also give the service account **BigQuery Job User** on the project that
will run the queries and **BigQuery Data Viewer** on the export dataset — see
[BigQuery export](#bigquery-export).

## 2. Deploy to Cloudflare

Click the button above. Cloudflare will:

- fork `adacahq/adaca-analytics` into your GitHub account and connect Workers Builds
  to it (pushes to `main` redeploy);
- create the **D1 database** (`DB`) and **KV namespace** (`CACHE`) declared in
  `wrangler.jsonc`;
- prompt for the secrets listed in `.dev.vars.example`:
  - `GOOGLE_SERVICE_ACCOUNT_JSON` — paste the **entire contents** of the key file
    (it is one JSON object; the app parses it);
  - `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD` — optional, see below;
- run `npm run build` and `npm run deploy`, which applies the D1 migrations and
  deploys the Worker with its cron trigger.

When it finishes you get a `*.workers.dev` URL. Open it and the setup wizard starts.

## Protecting your deployment

**There is no sign-in.** Anyone who can reach the URL can see your analytics. Put a
gate in front of it — either of these takes a few minutes:

### Option A — Cloudflare Access (recommended)

1. In the Cloudflare dashboard open **Zero Trust → Access → Applications → Add an
   application → Self-hosted**.
2. Set the application domain to your Worker's hostname (the `*.workers.dev` URL or a
   custom domain you have attached to the Worker).
3. Add a policy: *Allow* → *Emails ending in* `@yourcompany.com` (or specific emails,
   a Google Workspace group, etc.).
4. Save. Visitors now sign in through Access before the Worker ever sees the request;
   nothing in the app changes.

If an uptime monitor needs to reach `/api/health` unauthenticated, add a **Bypass**
policy for that path.

### Option B — built-in HTTP Basic Auth

Set both secrets and the Worker answers every request except `/api/health` with a
browser password prompt:

```
npx wrangler secret put BASIC_AUTH_USERNAME
npx wrangler secret put BASIC_AUTH_PASSWORD
```

Leave both unset (or empty) and the gate is off. One shared credential is fine for a
small team; use Access for anything more.

Every response also carries `X-Robots-Tag: noindex`, and `robots.txt` disallows
everything, so an unprotected deployment at least stays out of search engines.

### Shared dashboards pass the gate

Share links (**More → Share…** on any dashboard, see [Sharing](#sharing)) are for
people without access: `/share/<token>` and its data route `/api/share/*` are open by
design, together with the client assets under `/_next/*` and the logo and favicon
files. The built-in Basic Auth gate already lets those through, for GET only, so
nothing can be changed through a share URL. With Cloudflare Access, add a **Bypass**
policy for the paths `/share/*`, `/api/share/*`, `/_next/*`, `/logo.svg`,
`/logo-white.svg`, `/favicon.png` and `/apple-touch-icon.png`. Revoking a link closes
it immediately.

## 3. First run

The wizard has four steps:

1. **Credentials** — confirms the secret parses and shows the service-account email
   to grant access to.
2. **Property** — lists every GA4 property the account can see (or take a property
   id typed by hand). Or choose **BigQuery export only** for a site that has no GA
   property you can read — for example the public sample dataset.
3. **BigQuery** — optional for GA properties: point at the export dataset and the
   daily rollups come from BigQuery instead of the Data API.
4. **Backfill** — how much history to pull now (30 / 90 / 180 / 365 days).

Creating the site queues a backfill. A progress banner on the dashboard pumps it from
your browser so it completes in minutes; the cron continues it if you close the tab.
From then on every site is **refreshed hourly** for its trailing three days (GA
finalises data for up to ~72 hours), and **Settings → Ingestion** lets you refresh or
re-backfill on demand.

Add more properties from **Settings → Sites → Add site** and switch between them in
the topbar.

## How the numbers are made

Every site is ingested into the same twenty **report families** — one row per day
per dimension value:

| Family | Dimension(s) | Feeds |
|---|---|---|
| `totals` | — | the headline numbers and time series |
| `page` | page path, title | Pages viewed, Page titles |
| `landing` | landing page | Landing pages |
| `source` | source, medium | Sources, Mediums, Source / medium |
| `channel` | default channel group | Channels |
| `campaign` | campaign, source | Campaigns |
| `referrer` | referring host | Referrers |
| `geo` | country, city | Countries, Cities |
| `device` | device category, OS | Devices, Operating systems |
| `browser`, `language`, `screen` | one each | Browsers, Languages, Screen resolutions |
| `user_type` | new vs returning | New vs returning |
| `event` | event name, is key event | Events, Key events |
| `hour` | hour of day | Hour of day (weekday comes from `totals`); the hourly trend of Today / Yesterday |
| `region` | country, region | Regions |
| `utm_content`, `utm_term` | ad content / term, campaign | Ad content, Terms |
| `os_version` | OS, version | OS versions |
| `host` | hostname | Hostnames |

A site backfilled before a family existed shows **Add N new reports** on
**Settings → Ingestion**, which ingests only the missing families over the days the
site already holds.

Sites with **drill-down** on (the default) are also ingested into seventeen **pair
families**, two dimensions per row, which power the detail pages and the "by"
datasets in the builder: source / medium × landing page, page, country, device and
event; channel × source / medium, landing page, page and country; campaign × landing
page; referrer × page; page × country, device and event; landing page × country and
device; and country × device. Source and medium travel as GA's combined
`source / medium` string, so a source page filters `google / %` and a medium page
`% / organic`.

Each row stores eight metrics — users, new users, sessions, engaged sessions,
pageviews, engagement seconds, key events, event count — and widgets sum them over
the chosen period. Ratios (engagement rate, bounce rate, average engagement time,
views per visit, key-event rate) are computed from the sums, never averaged per day.

**Visitors are the one exception.** Daily unique visitors summed over a range
over-count anyone who came back on another day. For the site-wide **Visitors** and
**New visitors** tiles on a GA-backed site, the app asks GA for the exact figure over
the period (cached ten minutes) — so the tile matches the GA UI. Visitor counts inside
breakdowns (by country, by page…) are sums of daily uniques; treat them as
"visitor-days".

"Visits" are GA4 sessions. "Key events" are whatever the property marks as key events
(GA's name for conversions). The **Period** control in the topbar is remembered in the
URL, so a dashboard link reproduces the view; "Compare to previous period" adds the
same-length window before it.

## BigQuery export

If a property exports to BigQuery (GA Admin → Product links → BigQuery links), the
daily rollups can come from the export instead of the Data API: no sampling, no API
quota, and a jobs-project bill measured in cents. Realtime still uses the GA API.

Grant the service account:

- **BigQuery Job User** on the project that runs the queries (the *jobs project*,
  usually the one the service account belongs to);
- **BigQuery Data Viewer** on the export dataset (or its project).

In the wizard, enter the jobs project and the dataset as `analytics_<property id>` (or
`project.dataset` for a dataset in another project) and press **Test connection** —
it lists the day tables it can see. Each report family is one query per 31-day chunk
over `events_*` (intraday tables included).

**Try it without your own export:** choose *BigQuery export only* in the wizard and
use Google's public sample, `bigquery-public-data.ga4_obfuscated_sample_ecommerce`,
which holds three months of an e-commerce site (2020-11-01 → 2021-01-31). Set the
key event to `purchase`. Queries against it run in your jobs project.

BigQuery numbers differ slightly from the GA interface, which applies thresholding and
modelling the raw export does not. Session-scoped families (visits, landing pages,
sources, channels, geography, devices…) attribute a whole session to the day it
started, so a session that crosses midnight counts on its first day — the same
convention GA uses. Derivations are documented at the top of
`src/lib/analytics/bq-sql.ts`.

## Dashboards and widgets

- **Customise** puts a dashboard into edit mode: drag by the handle, resize from the
  corner, edit / copy / remove any widget, **+ Add widget**, then **Done**.
- **Add widget** walks four steps: the **data type** (Overview, Realtime, Acquisition,
  Content, Audience, Behaviour, or a Note), the **specific data** (e.g. Pages viewed),
  the **chart type** the data supports (Number, Line, Columns, Bars, Donut, Ranked
  list, Table), then **configure**: title, metric, rows, sort, filters, grouping,
  comparison.
- **More** on any dashboard: *Reset to template* (default dashboards), *Duplicate*,
  and for custom dashboards *Rename* and *Delete*.
- **+ New dashboard** in the rail starts blank or from any of the six templates.

Dashboards are shared by everyone who can open the deployment; there are no user
accounts.

**On a phone or tablet** the same dashboards reflow rather than shrink: below 900px
the rail becomes a drawer behind **Menu** and widgets fall into two columns (charts
span both); below 640px KPI tiles form a compact strip, charts get a phone-sized
plot, lists grow to their rows, tables scroll sideways inside their card, and the
settings tables become card lists. **Customise** still works: drag gives way to
move up / move down, and the widget builder opens as a bottom sheet whose footer
stays put while the form scrolls. Every tap target is at least 40px on touch screens.

## Drill-down

Almost every value on a dashboard opens: a source, a page, a landing page, a channel,
a campaign, a referrer, a country, a city, a device, an OS, an event… Ranked-list rows,
table cells, bars, columns, donut sectors, the legend entries and axis labels beside
them, and KPI tiles narrowed to one value by an exact filter are all links to
`/detail/<kind>/<value>`, carrying the dashboard's period along. Marks over time work
the other way: a click on a day, week or month in a line or column chart (or on its
date label) narrows the page to that span, on dashboards and on detail pages alike.
Every clickable mark says so in its tooltip and takes the pointer; the few that
cannot open anything (day-of-week columns, realtime minutes, site-wide totals) stay
plain.

A detail page shows, for the chosen period and the period before:

- the entity's **KPIs** with deltas (visits, visitors, engagement rate, average
  engagement time, pageviews, key events, key-event rate; pageviews-led for pages and
  referrers, events-led for events) and its **share of the site**;
- a **trend** of the lead metric, with the previous period dashed behind it;
- **breakdowns** — for a source: landing pages, pages, countries, devices, events,
  channels, mediums and campaigns; for a page: sources, channels, referrers, countries,
  devices, events on the page and titles; for a country: cities, pages, landing pages,
  sources, channels and devices; and so on. Every breakdown row opens its own page, so
  you can walk *google / organic → the landing page it sends people to → the countries
  they come from* without leaving precomputed data.

Everything on a detail page is **precomputed**. The breakdowns read the pair families
described in *How the numbers are made*, and a page is one D1 round trip (about ten
statements, tens of milliseconds); no Google call is made on the way. To keep storage
bounded on large sites, each pair family keeps the top **1,500** combinations per day
(by visits, or by events for event-level pairs) and folds the rest into one `(other)`
row, so totals and shares still add up exactly. Sites the size of a company website
never reach the cap.

Existing sites: **Settings → Ingestion → Add drill-down data** ingests the pair
families over the days the site already holds, without re-pulling the single-dimension
rollups. New sites get them with their first backfill. The per-site **Drill-down**
switch in **Settings → Sites** turns the pairs off for deployments that must stay
inside the free D1 plan; existing rows are kept.

The pair families are also builder datasets — *Pages by source*, *Sources by page*,
*Landing pages by channel*, *Events by page*, *Countries by source*, *Devices by
landing page*… — where a filter on the other dimension narrows them ("Pages by source"
+ *Source / medium is google / organic*).

## Period, comparison and shortcuts

The **Period** control offers Today, Yesterday, the last 7 / 28 / 90 days, this month,
last month, year to date, the last 12 months, all time (from the site's first day) and
a custom span. Every preset has a one-letter shortcut, shown beside it — D, E, W, T,
Q, M, P, Y, L, A — X toggles the comparison and C opens the custom fields. **Compare**
puts a second window behind every widget: the period before (the default), the same
dates a year earlier, or any window you choose; deltas and dashed lines follow, and
every caption says which ("vs prev", "vs last year", "vs period"). The URL carries all
of it (`?range=7d&compare=yoy`, `?from=…&to=…&compare=2025-08-01..2025-08-28`), so a
link reproduces the view.

Site-wide totals over a day or two chart **by the hour**: Today and Yesterday show an
hourly line (today up to the current hour), read from the hour-of-day family the site
already holds; a widget can also ask for hours in *Group by*. The **live count** in
the topbar — people on the site in the last 30 minutes — is on every screen and opens
the Realtime dashboard.

## Filters and segments

**Filter** in the topbar applies one condition to a whole dashboard: a dimension
(source, medium, source / medium, channel, campaign, referrer, page, landing page,
country, device, event — and any other entity kind, for totals and trends), an
operator (is, is not, contains, does not contain) and a value, with suggestions from
the site's own data. It lives in the URL (`?seg=source:eq:google`) so links keep it,
and **Save as segment** keeps it by name for everyone on the deployment.

Segments are served from stored rollups, never a live call. Totals, KPI tiles and
trends read the segment's own family, so they are exact. A ranked widget follows the
filter when its dimension is stored together with the filter's — on its own family
(Sources under a medium filter, Pages under a title filter, Countries under a city
filter) or on a pair family (Landing pages under a channel filter reads channel ×
landing page; Sources under a landing-page filter reads source / medium × landing
page and splits the source out). A widget with no stored pair for the combination
says so in place of its numbers ("Channel is not stored together with referrer")
rather than showing unfiltered data. Realtime widgets are never filtered and say so in
their caption. The site-wide Visitors tile stays exact under a filter: the same GA
lookup carries the filter as a dimension filter. Detail pages ignore the filter — they
are already one dimension — and say so.

## Explore and export

**See all** on any card (and *top N · see all* on any breakdown of a detail page) opens
`/explore/<dataset>`: every row for the period (up to 500), every metric of the
dataset, a share column on the lead metric, search, column sorting and a **CSV
download**. The page honours the dashboard filter and a widget's own filters, and its
rows drill like a dashboard's.

## Sharing

**More → Share…** on any dashboard creates a read-only link, `/share/<token>`, for the
current site: no rail, no filter control, no drill-down, nothing to change. A link can
**lock the period** to the current one and **pin the current filter**, which is how a
slice of the data is shared without the rest; otherwise the reader chooses the period.
**Embed** gives an `<iframe>` snippet (`?embed=1` hides the bar). Revoke a link and it
stops resolving at once. Widgets on a shared page load through
`/api/share/<token>/widget`, which serves that dashboard for that site and nothing
else; see *Protecting your deployment* for what the gate lets through.

## Reports and alerts

**Settings → Reports** schedules deliveries by **email** or to a **Slack** channel:

- **Weekly summary** — every Monday after 08:00 site time: last week's visitors,
  visits, pageviews, engagement rate, average engagement time and key events with
  deltas against the week before, the top pages, sources and countries, and a link
  to the dashboard for that period.
- **Monthly summary** — the same on the 1st, for the month before.
- **Traffic spike alert** — when the live visitor count reaches a threshold; at most
  once every 12 hours.
- **Traffic drop alert** — when visits in the last 12 hours fall below a threshold
  (from the hourly family the refresh keeps current); checked hourly, at most once
  every 12 hours.

The cron delivers them; nothing needs to be open. **Send now** delivers a report
immediately, which is how to check a channel works; each report shows its last
delivery or error. Slack needs only an incoming-webhook URL. Email goes through
[Resend](https://resend.com) — set two secrets and the email channel switches on:

```
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put REPORT_FROM     # a sender on a domain verified in Resend
```

Links in reports use the address the app was last opened at.

## Local development

```
git clone https://github.com/adacahq/adaca-analytics
cd adaca-analytics
npm install
cp .dev.vars.example .dev.vars     # paste your service-account JSON on one line
npm run types                      # generate worker-configuration.d.ts
npm run db:migrate                 # apply migrations to the local D1
npm run dev                        # http://localhost:3000
```

`vinext dev` runs the app inside workerd via the Cloudflare Vite plugin, so D1 and KV
are real local bindings (state under `.wrangler/state`). The cron can be fired by hand:

```
curl 'http://localhost:3000/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*'
```

Gates: `npm run build` (the authoritative check of the app graph), `npm run typecheck`,
`npm run lint`, `npm test`. The BigQuery SQL has a live test against the public sample
dataset that runs only when you point it at a key:

```
GOOGLE_SA_KEY_FILE=~/.secrets/my-service-account.json npm test
```

## Deploying by hand

```
npx wrangler login
export CLOUDFLARE_ACCOUNT_ID=…            # pin the account
npx wrangler d1 create adaca-analytics     # once; paste the id into wrangler.jsonc
npx wrangler kv namespace create CACHE     # once; paste the id into wrangler.jsonc
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npm run deploy                             # build, apply migrations, deploy
```

`npm run deploy` runs `vinext build`, `wrangler d1 migrations apply DB --remote`, then
`wrangler deploy` with the generated config in `dist/server/wrangler.json`.

## Architecture

- **vinext** (the Next.js App Router API surface on Vite) + React 19 + Tailwind v4,
  built and served by a Cloudflare Worker. `worker/index.ts` wraps vinext's fetch
  handler to add the cron handler and the optional Basic Auth gate.
- **D1** holds `sites`, `dashboards` (widget layouts as JSON), `rollups` (the fact
  table, composite key `site · report · date · key1 · key2`, with a reverse index on
  `key2` so both directions of a pair family are fast), `ingest_runs`, `segments`
  (saved filters), `shares` (share links), `reports` (scheduled deliveries) and
  `settings`. Migrations live in `migrations/`.
- **KV** caches Google access tokens (55 min), realtime reports (30 s), exact-uniques
  lookups (10 min) and the property list.
- **Ingestion** is bounded-unit pumping: a run is cut into units (one report family ×
  one ≤31-day chunk), each small enough for any invocation budget. The cron ticks every
  15 minutes; the browser pumps `/api/ingest/advance` while a run is active.
- **Query engine**: widget config + period → parameterised SQL over `rollups`, or a
  live GA realtime call; results are render-ready shapes (`kpi`, `timeseries`,
  `ranked`, `table`). Detail pages go through `src/lib/analytics/drill.ts`, which
  batches every statement for a page into one D1 call; `entities.ts` is the registry
  of entity kinds and their breakdowns; `segments.ts` resolves a dataset under the
  dashboard filter to the family and keys that answer it. Explore pages
  (`/explore/<dataset>`) run the same engine as a 500-row table.
- **Sharing and reports**: `/share/<token>` renders a dashboard read-only outside the
  app shell, fed by `/api/share/<token>/widget`; `src/lib/gate.ts` is the one rule for
  what the Basic Auth gate lets through. `src/lib/reports/` builds the weekly /
  monthly summaries and alerts, delivers them (Resend, Slack webhooks) and runs from
  the cron tick after the ingestion pump.
- **Design system**: the Canvas system shared with Adaca's other apps — `src/app/
  globals.css` is the single source of truth; see `docs/design-system.md`.

## Limits and caveats

- **Free plan D1 is 500 MB** (10 GB on Workers Paid). A busy site writes roughly
  5,000 single-dimension rollup rows a day (~1 MB); with drill-down on, the pair
  families add up to 25,000 rows a day on a very large site (the 1,500-per-family cap)
  and a few hundred on a small one. A year of a small site fits the free plan with
  drill-down on; a large site wants the paid plan, or drill-down switched off for it.
- **GA Data API quota** — a backfill is about 32 requests per site per 31 days of
  history with drill-down on (15 without); the hourly refresh is the same per tick.
  Well inside the standard quota.
- **Realtime** needs a GA4 property; BigQuery-only sites have no realtime view.
- **Screen resolutions** are not in the BigQuery export, so that dataset stays empty
  for BigQuery-fed sites.
- Timezones: rollup dates are the property's reporting timezone (read from GA at
  setup, editable per site); "Today" is today there.
- **One filter at a time.** Two conditions together (source *and* country) would need
  three-dimension rollups, which are not stored; a widget whose dimension has no pair
  with the filter's says so. Filters on city, OS, browser, language, screen, visitor
  type, hour, region, ad content, term, OS version and hostname narrow totals and
  trends only.
- **Hours exist for site-wide totals only**; every other family is daily, so there is
  no "last 24 hours" period and no hourly breakdown by page or source.
- **Drop alerts** depend on the hourly refresh: they check only while the site was
  ingested up to yesterday or today.

## Licence

MIT © Adaca
