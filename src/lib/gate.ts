/**
 * What the optional Basic Auth gate (worker/index.ts) lets through without
 * credentials. Pure, so it is unit-tested: the rule decides what a stranger
 * with a share link can reach.
 *
 *  - health, robots, the favicon and the logo files;
 *  - shared dashboards (`/share/<token>`) and their client assets, for GET
 *    and HEAD only, so no server action can be invoked through a share URL
 *    (actions are POSTs to the page);
 *  - the share data route (`/api/share/*`), a plain route handler that
 *    resolves a token to one dashboard of one site and nothing else.
 */
export function isOpenPath(path: string, method: string): boolean {
  if (path === '/api/health' || path === '/robots.txt') return true;
  if (path === '/favicon.ico' || path === '/favicon.png' || path === '/apple-touch-icon.png' || path === '/logo.svg' || path === '/logo-white.svg') return true;
  if (path.startsWith('/api/share/')) return true;
  const read = method === 'GET' || method === 'HEAD';
  return read && (path.startsWith('/share/') || path.startsWith('/_next/'));
}
