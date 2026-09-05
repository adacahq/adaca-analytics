import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const sites = await env.DB.prepare('SELECT COUNT(*) AS n FROM sites WHERE deleted_at IS NULL').first<{ n: number }>();
  return (
    <main className="p-10">
      <h1 className="text-2xl font-semibold">Adaca Analytics</h1>
      <p className="mt-2">Phase 0 skeleton. Sites in D1: {sites?.n ?? 0}.</p>
    </main>
  );
}
