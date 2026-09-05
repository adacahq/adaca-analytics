import { env } from 'cloudflare:workers';
import { kv } from '@/lib/db/client';
import { base64url, pemToDer } from './encoding';

/** The fields of a service-account key this app reads. */
export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
  project_id?: string;
}

export const SCOPES = {
  analytics: 'https://www.googleapis.com/auth/analytics.readonly',
  bigquery: 'https://www.googleapis.com/auth/bigquery.readonly',
} as const;

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

/** Parse the secret. Throws a GoogleAuthError that explains what to fix. */
export function loadServiceAccount(): ServiceAccount {
  const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new GoogleAuthError(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not set. Paste the whole service-account JSON key as that secret (wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON, or .dev.vars locally).',
    );
  }
  let parsed: Partial<ServiceAccount> & { type?: string };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new GoogleAuthError('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. It must be the unmodified key file, on one line.');
  }
  if (parsed.type !== 'service_account' || !parsed.client_email || !parsed.private_key) {
    throw new GoogleAuthError('GOOGLE_SERVICE_ACCOUNT_JSON does not look like a service-account key (needs type, client_email and private_key).');
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    token_uri: parsed.token_uri ?? 'https://oauth2.googleapis.com/token',
    project_id: parsed.project_id,
  };
}

/** Is the secret present and parseable? Never throws. */
export function serviceAccountStatus(): { ok: true; email: string; project: string | null } | { ok: false; error: string } {
  try {
    const sa = loadServiceAccount();
    return { ok: true, email: sa.client_email, project: sa.project_id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function signJwt(sa: ServiceAccount, scopes: string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: sa.client_email, scope: scopes.join(' '), aud: sa.token_uri, iat: now, exp: now + 3600 }),
  );
  const unsigned = `${header}.${claims}`;
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  } catch {
    throw new GoogleAuthError('The service-account private_key could not be parsed. Re-download the JSON key from Google Cloud.');
  }
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(sig)}`;
}

/**
 * An OAuth2 access token for the service account. Cached in KV for 55 of its
 * 60 minutes so a dashboard with twenty widgets and the hourly ingest share
 * one token exchange.
 */
export async function accessToken(scopes: string[] = [SCOPES.analytics, SCOPES.bigquery]): Promise<string> {
  const sa = loadServiceAccount();
  const cacheKey = `gtoken:${sa.client_email}:${scopes.join(',')}`;
  try {
    const cached = await kv().get(cacheKey);
    if (cached) return cached;
  } catch {
    // KV unavailable: fall through to a fresh exchange.
  }
  const assertion = await signJwt(sa, scopes);
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new GoogleAuthError(`Google rejected the service-account credentials: ${body.error_description ?? body.error ?? res.status}`);
  }
  const ttl = Math.max(60, Math.min(3300, (body.expires_in ?? 3600) - 300));
  try {
    await kv().put(cacheKey, body.access_token, { expirationTtl: ttl });
  } catch {
    // Cache miss next time; not fatal.
  }
  return body.access_token;
}
