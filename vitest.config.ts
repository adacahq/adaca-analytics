import { defineConfig } from 'vitest/config';

/**
 * Unit tests target the PURE modules (date ranges, the widget catalogue,
 * metric derivations, the SQL builders, dashboard templates) — no D1, no
 * network, no Workers runtime. The authoritative typecheck remains
 * `npm run build`; this config deliberately avoids the vinext/cloudflare plugins.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
