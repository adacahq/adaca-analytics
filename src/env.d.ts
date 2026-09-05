/**
 * Secrets are not part of wrangler.jsonc, so `wrangler types` only learns
 * their names from a local `.dev.vars` — absent on CI and on a fresh clone.
 * This augmentation merges into the generated global `Env` (see
 * worker-configuration.d.ts) so the app typechecks everywhere.
 */
interface Env {
  /** The service-account JSON key, verbatim. */
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  /** Optional Basic Auth gate (both must be set to enable it). */
  BASIC_AUTH_USERNAME?: string;
  BASIC_AUTH_PASSWORD?: string;
}
