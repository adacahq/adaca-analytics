'use server';

import { revalidatePath } from 'next/cache';
import { setSetting } from '@/lib/db/settings';
import { isPaletteKey } from './palette';

export type SettingResult = { ok: true } | { ok: false; error: string };

/** Change the chart palette for everyone; every layout re-reads it on the next render. */
export async function setPaletteAction(key: string): Promise<SettingResult> {
  try {
    if (!isPaletteKey(key)) return { ok: false, error: 'Unknown palette' };
    await setSetting('palette', key);
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save' };
  }
}
