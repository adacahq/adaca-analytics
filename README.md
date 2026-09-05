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
8. [Local Development](#8-local-development)
9. [Deploying by Hand](#9-deploying-by-hand)
10. [Architecture](#10-architecture)
11. [Limits and Caveats](#11-limits-and-caveats)
12. [About Adaca](#12-about-adaca)
13. [Licence](#13-licence)

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

Every site is ingested into the same fifteen report families, one row per day per
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
| `hour` | hour of day | Hour of day (day of week comes from `totals`) |

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
is stored in the URL, so a dashboard link reproduces the view. **Compare with the
previous period** adds the same-length window before it.

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
accounts.

## 8. Local Development

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

## 9. Deploying by Hand

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

## 10. Architecture

- **vinext** (the Next.js App Router API surface on Vite), React 19 and Tailwind v4,
  built and served by a Cloudflare Worker. `worker/index.ts` wraps vinext's fetch
  handler to add the cron handler and the optional Basic Auth gate.
- **D1** holds `sites`, `dashboards` (widget layouts as JSON), `rollups` (the fact
  table, composite key `site · report · date · key1 · key2`), `ingest_runs` and
  `settings`. Migrations live in `migrations/`.
- **KV** caches Google access tokens for 55 minutes, realtime reports for 30 seconds,
  exact-uniques lookups for 10 minutes, and the property list.
- **Ingestion** is bounded-unit pumping. A run is cut into units, one report family by
  one chunk of at most 31 days, each small enough for any invocation budget. The cron
  ticks every 15 minutes, and the browser calls `/api/ingest/advance` while a run is
  active.
- **The query engine** turns widget config and period into parameterised SQL over
  `rollups`, or a live Google Analytics realtime call, and returns render-ready shapes
  (`kpi`, `timeseries`, `ranked`, `table`).
- **The design system** is Canvas, shared with Adaca's other apps. `src/app/globals.css`
  is the single source of truth. See `docs/design-system.md`.

## 11. Limits and Caveats

- **D1 storage.** A database on the Workers Free plan holds 500 MB, and 10 GB on
  Workers Paid. A busy site writes roughly 5,000 rollup rows a day, about 1 MB, so a
  year of one site fits either plan. Many large sites want the paid plan.
- **GA4 Data API quota.** A backfill is about 15 requests per site per 31 days of
  history, and the hourly refresh is 15 requests, well inside the standard quota.
- **Realtime** needs a GA4 property. BigQuery-only sites have no realtime view.
- **Screen resolutions** are not in the BigQuery export, so that dataset stays empty
  for BigQuery-fed sites.
- **Timezones.** Rollup dates are in the property's reporting timezone, read from
  Google Analytics at setup and editable per site. "Today" is today there.

## 12. About Adaca

Adaca is a software consultancy. We build custom software, embed senior engineers in
client teams, and put AI to work across Australia and New Zealand. Adaca Analytics is
open-source software we maintain and release under the MIT licence.

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## 13. Licence

MIT. See [LICENSE](LICENSE).
