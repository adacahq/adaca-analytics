/**
 * Secrets are not part of wrangler.jsonc, so `wrangler types` only learns
 * their names from a local `.dev.vars` — absent on CI and on a fresh clone.
 * These augmentations merge into the generated `Cloudflare.Env` (what
 * `import { env } from 'cloudflare:workers'` is typed as) and the global
 * `Env` (the worker entry's handler signature) so the app typechecks everywhere.
 */
interface AppSecrets {
  /** The service-account JSON key, verbatim. */
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  /** Optional Basic Auth gate (both must be set to enable it). */
  BASIC_AUTH_USERNAME?: string;
  BASIC_AUTH_PASSWORD?: string;
  /** Optional email delivery for reports: a Resend API key and the sender address. */
  RESEND_API_KEY?: string;
  REPORT_FROM?: string;
}

declare namespace Cloudflare {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Env extends AppSecrets {}
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Env extends AppSecrets {}
