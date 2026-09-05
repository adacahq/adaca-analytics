import { env } from 'cloudflare:workers';

/**
 * Liveness + binding check. Always outside the Basic Auth gate (worker/index.ts)
 * so uptime monitors and a Cloudflare Access bypass rule have a target.
 * Reports whether D1 answers and whether the Google secret is present —
 * never its contents.
 */
export async function GET() {
  let db = false;
  try {
    const row = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    db = row?.ok === 1;
  } catch {
    db = false;
  }
  const google = Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return Response.json(
    { ok: db, db, google, version: '0.1.0' },
    { status: db ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
