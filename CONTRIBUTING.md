# Contributing

Thanks for helping make Adaca Analytics better. The codebase is small and opinionated.
The notes below are what a reviewer will check.

## Getting Set Up

```
npm install
cp .dev.vars.example .dev.vars   # a Google service-account key, see the README
npm run types                    # worker-configuration.d.ts from wrangler.jsonc
npm run db:migrate               # local D1
npm run dev
```

Four gates run in CI:

| Command | What it proves |
|---|---|
| `npm run build` | the whole app graph compiles for every environment (RSC, SSR, client) |
| `npm run typecheck` | `tsc --noEmit` over `src/` and `worker/` |
| `npm run lint` | eslint (TypeScript and react-hooks) |
| `npm test` | vitest over the pure modules |

`GOOGLE_SA_KEY_FILE=~/.secrets/key.json npm test` also runs the BigQuery SQL against
Google's public GA4 sample dataset.

## Where Things Live

- `src/lib/analytics/` is the engine: `reports.ts` (report families), `catalog.ts`
  (the builder's taxonomy), `metrics.ts`, `ranges.ts`, `query-sql.ts` and `query.ts`
  (rollups to widget data), `live.ts` (realtime), `ingest.ts` (the pump) and
  `bq-sql.ts`.
- `src/lib/google/` holds service-account auth (a WebCrypto JWT), the GA4 Data and
  Admin clients, and BigQuery.
- `src/lib/db/` is D1 access. `client.ts` is the only place `cloudflare:workers` is
  imported for bindings.
- `src/lib/dashboard/` holds widget types, the chart registry, templates and server
  actions.
- `src/components/dashboard/` holds the grid, the card, the chart bodies and the
  four-step builder.
- `src/app/globals.css` is the design system. Read `docs/design-system.md` before
  adding UI. Prefer a named class over Tailwind, and set colour only through
  `var(--token)`.
- `migrations/` holds the D1 migrations, applied by `npm run deploy`. Never edit a
  shipped migration. Add a new numbered file.

## Conventions Worth Knowing

- **Pure modules stay pure.**
  Anything under `src/lib/analytics/` that unit-tests must not import
  `cloudflare:workers` or `next/*`. Keep D1, KV and fetch behind
  `src/lib/db/client.ts` and `src/lib/google/`.
- **Every rollup family shares the eight metric columns.**
  A new family is a registry entry in `reports.ts`, plus a `bq-sql.ts` case if
  BigQuery can derive it. The query engine needs no change. A new widget dataset is a
  `catalog.ts` entry.
- **A chart type is a registry entry plus a body.**
  See `src/lib/dashboard/widgets.tsx` and `WidgetBody.tsx`.
- **Blue is chrome, orange is data.**
  `--accent` for controls and active states, the `--series-*` ramp for every chart
  mark. Deltas use the semantic tones.
- **SQL built from data lives in one place.**
  `src/lib/db/sql.ts`, with tests. Everything else is parameterised.
- **No sign-in by design.**
  Do not add auth middleware. Protection is documented as a deployment concern in the
  README.
- **Copy follows the Adaca house style.**
  Australian spelling, plain sentences, no em dashes, Title Case headings, and
  sentence case for buttons, labels and questions.

## Pull Requests

- One change per PR, with the gate output in the description.
- If you touched the design system, include a screenshot in both themes.
- If you touched ingestion or SQL, say which dataset you ran it against.
