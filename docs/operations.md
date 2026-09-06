# Operations

Deploying, protecting and running an Adaca Analytics deployment. For what it shows,
see [Features](features.md); for how it is built, [Architecture](architecture.md).

## A Google Service Account


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
[BigQuery Export](#bigquery-export).

## Deploy to Cloudflare


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

## Protecting Your Deployment


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

Share links (**More**, then **Share**, on any dashboard; see [Sharing](features.md#sharing))
are for people without access. `/share/<token>` and its data route `/api/share/*`
are open by design, together with the client assets under `/_next/*` and the logo and
favicon files. The built-in Basic Auth gate already lets those through, for GET only,
so nothing can be changed through a share URL. With Cloudflare Access, add a
**Bypass** policy for the paths `/share/*`, `/api/share/*`, `/_next/*`, `/logo.svg`,
`/logo-white.svg`, `/favicon.png` and `/apple-touch-icon.png`. Revoking a link closes
it at once.

## First Run


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

## BigQuery Export


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

## Deploying by Hand


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

## Limits and Caveats


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
