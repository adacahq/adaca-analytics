# Contributing

Thanks for helping make Adaca Analytics better. This is a small, opinionated codebase;
the notes below are what a reviewer will check.

## Getting set up

```
npm install
cp .dev.vars.example .dev.vars   # a Google service-account key, see README
npm run types                    # worker-configuration.d.ts from wrangler.jsonc
npm run db:migrate               # local D1
npm run dev
```

The four gates, all of which CI runs:

| Command | What it proves |
|---|---|
| `npm run build` | the whole app graph compiles for every environment (RSC, SSR, client) |
| `npm run typecheck` | `tsc --noEmit` over `src/` and `worker/` |
| `npm run lint` | eslint (TypeScript + react-hooks) |
| `npm test` | vitest over the pure modules |

`GOOGLE_SA_KEY_FILE=~/.secrets/key.json npm test` additionally runs the BigQuery SQL
against Google's public GA4 sample dataset.

## Where things live

- `src/lib/analytics/` — the engine. `reports.ts` (report families), `catalog.ts`
  (the builder's taxonomy), `metrics.ts`, `ranges.ts`, `query-sql.ts` + `query.ts`
  (rollups → widget data), `live.ts` (realtime), `ingest.ts` (the pump), `bq-sql.ts`.
- `src/lib/google/` — service-account auth (WebCrypto JWT), GA4 Data/Admin, BigQuery.
- `src/lib/db/` — D1 access. `client.ts` is the only place `cloudflare:workers` is
  imported for bindings.
- `src/lib/dashboard/` — widget types, chart registry, templates, server actions.
- `src/components/dashboard/` — grid, card, bodies, the four-step builder.
- `src/app/globals.css` — the design system. Read `docs/design-system.md` before
  adding UI; prefer a named class over Tailwind, colour only via `var(--token)`.
- `migrations/` — D1 migrations, applied by `npm run deploy`. Never edit a shipped
  migration; add a new numbered file.

## Conventions worth knowing

- **Pure modules stay pure.** Anything under `src/lib/analytics/` that unit-tests
  must not import `cloudflare:workers` or `next/*`. Keep D1/KV/fetch behind
  `src/lib/db/client.ts` and `src/lib/google/`.
- **Every rollup family shares the eight metric columns**, so a new family is a
  registry entry in `reports.ts` (+ a `bq-sql.ts` case if BigQuery can derive it) —
  the query engine needs no change. A new widget dataset is a `catalog.ts` entry.
- **Chart type = registry entry + body.** `src/lib/dashboard/widgets.tsx` and
  `WidgetBody.tsx`.
- **Blue is chrome, orange is data.** `--accent` for controls and active states;
  the `--series-*` ramp for every chart mark. Deltas use the semantic tones.
- **SQL from data is built in one place** (`src/lib/db/sql.ts`) with tests; everything
  else is parameterised.
- **No sign-in by design.** Do not add auth middleware; protection is documented as a
  deployment concern in the README.

## Pull requests

- One change per PR, with the gate output in the description.
- If you touched the design system, include a screenshot in both themes.
- If you touched ingestion or SQL, say which dataset you ran it against.
