'use server';

import { getSite } from '@/lib/db/sites';
import { activeUsersNow } from './live';

/** The topbar's live count: people on the site in the last 30 minutes, or null without a GA property / on error. */
export async function liveCount(siteId: string): Promise<number | null> {
  try {
    const site = await getSite(siteId);
    if (!site?.ga_property_id) return null;
    return await activeUsersNow(site);
  } catch {
    return null;
  }
}
