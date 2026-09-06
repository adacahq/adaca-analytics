import { defineConfig } from 'vite';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';

// The Cloudflare plugin runs the RSC environment inside workerd in dev as
// well as build, which is what makes `import { env } from 'cloudflare:workers'`
// (D1, KV) work under `vinext dev` without a wrangler dev sidecar.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    // Everything git ignores as generated. `.wrangler/state` is the one that
    // matters: local D1 is a real SQLite file, so every request writes its
    // WAL, the watcher fires and the page full-reloads — which issues another
    // request, and dev reloads forever. The rest are written by `npm run
    // build` / `typecheck`, which would otherwise storm reloads while running.
    watch: { ignored: ['**/.wrangler/**', '**/dist/**', '**/.vinext/**', '**/.next/**', '**/*.tsbuildinfo'] },
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
});
