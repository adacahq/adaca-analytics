'use server';

import { cookies } from 'next/headers';
import { SITE_COOKIE } from './context';

/** The site switcher: remember the choice for a year, then the caller refreshes. */
export async function selectSite(id: string): Promise<void> {
  const jar = await cookies();
  jar.set(SITE_COOKIE, id, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
}
