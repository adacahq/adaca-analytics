import { cookies } from 'next/headers';
import type { Site } from '@/lib/db/sites';
import { resolveRange, todayInZone, type DateRange, type RangeParams } from '@/lib/analytics/ranges';
import { parseSegment, type Segment } from '@/lib/analytics/segments';
import { earliestDate } from '@/lib/analytics/rollups';

export const SITE_COOKIE = 'analytics-site';

/**
 * The current site: the cookie the switcher sets, else the first site.
 * Server-only (reads next/headers).
 */
export async function currentSite(sites: Site[]): Promise<Site | null> {
  if (sites.length === 0) return null;
  const jar = await cookies();
  const wanted = jar.get(SITE_COOKIE)?.value;
  return sites.find((s) => s.id === wanted) ?? sites[0];
}

/** The page's range, resolved for the site's "today" ("All time" reads the site's first day). */
export async function rangeFor(site: Site | null, params: RangeParams): Promise<DateRange> {
  const today = todayInZone(site?.timezone ?? 'UTC');
  const earliest = site && params.range === 'all' ? await earliestDate(site.id) : null;
  return resolveRange(params, today, { earliest });
}

/** The dashboard-wide filter named in the URL, or null. */
export function segmentFor(params: RangeParams): Segment | null {
  return parseSegment(params.seg);
}

/** Search params as vinext hands them to a page, narrowed to what ranges read. */
export type SearchParams = Record<string, string | string[] | undefined>;

export function rangeParams(sp: SearchParams): RangeParams {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return { range: one('range'), from: one('from'), to: one('to'), compare: one('compare'), seg: one('seg') };
}
