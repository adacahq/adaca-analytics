import { db } from './client';
import { nanoid } from './nanoid';
import { paletteOf, type PaletteKey } from '@/lib/palette';

/** Deployment-wide key → JSON values (the app's own URL, for links in reports). */
export async function getSetting<T>(key: string): Promise<T | null> {
  const row = await db().prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db()
    .prepare('INSERT INTO settings (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(nanoid(), key, JSON.stringify(value))
    .run();
}

/** The deployment's chart palette (Settings → Appearance), blue unless set. */
export async function getPalette(): Promise<PaletteKey> {
  return paletteOf(await getSetting<string>('palette'));
}
