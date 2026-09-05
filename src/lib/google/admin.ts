import { googleJson } from './http';
import { SCOPES } from './auth';
import { kv } from '@/lib/db/client';

const ADMIN = 'https://analyticsadmin.googleapis.com/v1beta';

export interface PropertySummary {
  /** Numeric id, e.g. '351349891'. */
  id: string;
  displayName: string;
  account: string;
  accountName: string;
  propertyType: string;
}

interface SummariesBody {
  accountSummaries?: {
    account?: string;
    displayName?: string;
    propertySummaries?: { property?: string; displayName?: string; propertyType?: string }[];
  }[];
  nextPageToken?: string;
}

/** Every GA4 property the service account can see. Cached 10 min in KV. */
export async function listProperties(): Promise<PropertySummary[]> {
  const cacheKey = 'ga:properties';
  try {
    const cached = await kv().get(cacheKey, 'json');
    if (cached) return cached as PropertySummary[];
  } catch {
    // fall through
  }
  const out: PropertySummary[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${ADMIN}/accountSummaries?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await googleJson<SummariesBody>(url, { scopes: [SCOPES.analytics] });
    for (const acc of res.accountSummaries ?? []) {
      for (const p of acc.propertySummaries ?? []) {
        if (!p.property) continue;
        out.push({
          id: p.property.replace(/^properties\//, ''),
          displayName: p.displayName ?? p.property,
          account: acc.account ?? '',
          accountName: acc.displayName ?? '',
          propertyType: p.propertyType ?? 'PROPERTY_TYPE_ORDINARY',
        });
      }
    }
    pageToken = res.nextPageToken;
  } while (pageToken);
  try {
    await kv().put(cacheKey, JSON.stringify(out), { expirationTtl: 600 });
  } catch {
    // not fatal
  }
  return out;
}

export interface PropertyDetails {
  id: string;
  displayName: string;
  timeZone: string;
  currencyCode: string;
}

export async function getProperty(id: string): Promise<PropertyDetails> {
  const r = await googleJson<{ displayName?: string; timeZone?: string; currencyCode?: string }>(`${ADMIN}/properties/${id}`, {
    scopes: [SCOPES.analytics],
  });
  return { id, displayName: r.displayName ?? id, timeZone: r.timeZone ?? 'UTC', currencyCode: r.currencyCode ?? 'USD' };
}

/** Event names the property marks as key events (conversions). */
export async function listKeyEvents(id: string): Promise<string[]> {
  const out: string[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${ADMIN}/properties/${id}/keyEvents?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const r = await googleJson<{ keyEvents?: { eventName?: string }[]; nextPageToken?: string }>(url, { scopes: [SCOPES.analytics] });
    for (const k of r.keyEvents ?? []) if (k.eventName) out.push(k.eventName);
    pageToken = r.nextPageToken;
  } while (pageToken);
  return out;
}
