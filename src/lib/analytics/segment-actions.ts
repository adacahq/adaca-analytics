'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import { getSite } from '@/lib/db/sites';
import { createSegment, deleteSegment } from '@/lib/db/segments';
import { rangeFor } from '@/lib/context';
import { ENTITY_BY_KIND, isEntityKind } from './entities';
import { familyValuesSql } from './query-sql';
import { familySides, shownExpr, type Segment } from './segments';
import type { RangeParams } from './ranges';

export type SegmentResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const OPS = new Set(['eq', 'neq', 'contains', 'not_contains']);

/** Save the current filter under a name, for everyone. */
export async function saveSegmentAction(name: string, seg: Segment): Promise<SegmentResult<{ id: string }>> {
  try {
    const clean = name.trim().slice(0, 60);
    if (!clean) return { ok: false, error: 'Give the segment a name.' };
    if (!isEntityKind(seg.kind) || !OPS.has(seg.op) || !seg.value.trim()) return { ok: false, error: 'The filter is incomplete.' };
    const row = await createSegment({ name: clean, kind: seg.kind, op: seg.op, value: seg.value.trim().slice(0, 500) });
    revalidatePath('/', 'layout');
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed' };
  }
}

export async function deleteSegmentAction(id: string): Promise<SegmentResult> {
  try {
    await deleteSegment(id);
    revalidatePath('/', 'layout');
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete failed' };
  }
}

/**
 * The values a kind takes on a site in the current period, busiest first —
 * the suggestions under the filter's value field. One indexed read.
 */
export async function segmentValues(siteId: string, kind: string, params: RangeParams): Promise<string[]> {
  if (!isEntityKind(kind)) return [];
  const site = await getSite(siteId);
  if (!site) return [];
  const range = await rangeFor(site, params);
  const e = ENTITY_BY_KIND[kind];
  const [k1, k2] = familySides(e.family);
  const expr = e.match === 'sourceMedium' ? "(key1 || ' / ' || key2)" : shownExpr(e.side, e.side === 'key1' ? k1 : k2, kind);
  const stmt = familyValuesSql(site.id, e.family, expr, range.from, range.to, 120);
  const { results } = await db().prepare(stmt.sql).bind(...stmt.params).all<{ name: string }>();
  return results.map((r) => r.name).filter((v) => v !== '');
}
