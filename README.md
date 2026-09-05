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
8. [Local development](#local-development)
9. [Deploying by hand](#deploying-by-hand)
10. [Architecture](#architecture)
11. [Limits and caveats](#limits-and-caveats)

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

Every site is ingested into the same fifteen **report families** — one row per day
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
| `hour` | hour of day | Hour of day (weekday comes from `totals`) |

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
modelling the raw export does not. Derivations are documented at the top of
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
  table, composite key `site · report · date · key1 · key2`), `ingest_runs` and
  `settings`. Migrations live in `migrations/`.
- **KV** caches Google access tokens (55 min), realtime reports (30 s), exact-uniques
  lookups (10 min) and the property list.
- **Ingestion** is bounded-unit pumping: a run is cut into units (one report family ×
  one ≤31-day chunk), each small enough for any invocation budget. The cron ticks every
  15 minutes; the browser pumps `/api/ingest/advance` while a run is active.
- **Query engine**: widget config + period → parameterised SQL over `rollups`, or a
  live GA realtime call; results are render-ready shapes (`kpi`, `timeseries`,
  `ranked`, `table`).
- **Design system**: the Canvas system shared with Adaca's other apps — `src/app/
  globals.css` is the single source of truth; see `docs/design-system.md`.

## Limits and caveats

- **Free plan D1 is 500 MB** (10 GB on Workers Paid). A busy site writes roughly
  5,000 rollup rows a day (~1 MB), so a year of one site fits either plan comfortably;
  many large sites want the paid plan.
- **GA Data API quota** — a backfill is about 15 requests per site per 31 days of
  history; the hourly refresh is 15 requests. Well inside the standard quota.
- **Realtime** needs a GA4 property; BigQuery-only sites have no realtime view.
- **Screen resolutions** are not in the BigQuery export, so that dataset stays empty
  for BigQuery-fed sites.
- Timezones: rollup dates are the property's reporting timezone (read from GA at
  setup, editable per site); "Today" is today there.

## Licence

MIT © Adaca
