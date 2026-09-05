/**
 * Cloudflare Worker entry.
 *
 * Delegates HTTP to vinext's fetch handler and adds the two things the
 * framework entry can't express on its own:
 *
 *  1. `scheduled()` — the ingestion pump (wrangler.jsonc `triggers.crons`).
 *  2. An OPTIONAL HTTP Basic Auth gate. There is no sign-in in the app; set
 *     BASIC_AUTH_USERNAME + BASIC_AUTH_PASSWORD as secrets to enable it, or
 *     leave both unset and protect the worker with Cloudflare Access instead
 *     (README → "Protecting your deployment"). `/api/health` stays open so
 *     uptime checks and Access bypass rules have something to hit.
 *
 * Every response carries `X-Robots-Tag: noindex` — an analytics console is
 * never something to index.
 */
import handler from 'vinext/server/fetch-handler';
import { runScheduled } from '../src/lib/analytics/scheduled';

const AUTH_REALM = 'Adaca Analytics';
const NOINDEX = 'noindex, nofollow, noarchive, nosnippet';

function isOpenPath(path: string): boolean {
  return path === '/api/health' || path === '/robots.txt' || path === '/favicon.ico';
}

function gateEnabled(env: Env): boolean {
  return Boolean(env.BASIC_AUTH_USERNAME || env.BASIC_AUTH_PASSWORD);
}

function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get('Authorization');
  if (!header || !header.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx === -1) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return user === (env.BASIC_AUTH_USERNAME ?? '') && pass === (env.BASIC_AUTH_PASSWORD ?? '');
}

function unauthorized(): Response {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${AUTH_REALM}"`,
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': NOINDEX,
    },
  });
}

function withNoIndex(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', NOINDEX);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!isOpenPath(url.pathname) && gateEnabled(env) && !isAuthorized(request, env)) {
      return unauthorized();
    }
    const response = await handler.fetch(request, env, ctx);
    return withNoIndex(response);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runScheduled(env)
        .then((r) => console.log(`ingest tick: ${r.summary}`))
        .catch((err) => console.error('ingest tick failed', err)),
    );
  },
} satisfies ExportedHandler<Env>;
