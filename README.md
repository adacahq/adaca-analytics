# Adaca Analytics

Self-hosted dashboards for **Google Analytics 4** (and its **BigQuery** export), running
on **Cloudflare Workers**. It pulls daily rollups into D1 so dashboards are fast and
quota-free, keeps GA's realtime view live, and lets you build any dashboard you want
from configurable widgets.

> Phase 0 skeleton. Full README lands with the first release.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/adacahq/adaca-analytics)

## Local development

```
npm install
cp .dev.vars.example .dev.vars   # paste your service-account JSON
npm run types                    # generate worker-configuration.d.ts
npm run db:migrate               # apply D1 migrations to the local database
npm run dev                      # http://localhost:3000
```

## Scripts

- `npm run dev` — vinext dev server (runs in workerd; D1 and KV are local).
- `npm run build` — production build (also the authoritative typecheck of the app graph).
- `npm run deploy` — build, apply D1 migrations remotely, deploy the Worker.
- `npm test` / `npm run lint` / `npm run typecheck`.

## Licence

MIT © Adaca
