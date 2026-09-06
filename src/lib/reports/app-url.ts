import { headers } from 'next/headers';
import { getSetting, setSetting } from '@/lib/db/settings';

let known: string | null = null;

/**
 * The deployment's own URL, for links in emails and Slack messages. Learned
 * from the first request each isolate serves and kept in the settings table,
 * because the cron has no request to read it from.
 */
export async function rememberAppUrl(): Promise<void> {
  if (known) return;
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (!host) return;
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
    const url = `${proto}://${host}`;
    const current = await getSetting<string>('app_url');
    if (current !== url) await setSetting('app_url', url);
    known = url;
  } catch {
    // Not fatal: reports fall back to relative links.
  }
}

export async function appUrl(): Promise<string> {
  if (known) return known;
  return (await getSetting<string>('app_url')) ?? '';
}
