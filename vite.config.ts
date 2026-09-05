import { defineConfig } from 'vite';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';

// The Cloudflare plugin runs the RSC environment inside workerd in dev as
// well as build, which is what makes `import { env } from 'cloudflare:workers'`
// (D1, KV) work under `vinext dev` without a wrangler dev sidecar.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
});
