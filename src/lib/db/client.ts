import { env } from 'cloudflare:workers';

/**
 * Binding accessors. Server-only (RSC, server actions, route handlers, the
 * worker entry). Kept behind functions rather than module-level constants so
 * the pure modules that unit-test under Node never touch `cloudflare:workers`.
 */
export function db(): D1Database {
  return env.DB;
}

export function kv(): KVNamespace {
  return env.CACHE;
}

/** ISO-8601 UTC timestamp, the same shape the D1 defaults produce. */
export function nowIso(): string {
  return new Date().toISOString();
}
