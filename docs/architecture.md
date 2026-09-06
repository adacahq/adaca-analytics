# Architecture

How Adaca Analytics is put together. The design system has its own reference in
[design-system.md](design-system.md).

## Architecture


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
