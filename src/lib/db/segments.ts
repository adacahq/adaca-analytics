import { db } from './client';
import { nanoid } from './nanoid';
import type { FilterOp } from '@/lib/dashboard/types';
import type { EntityKind } from '@/lib/analytics/entities';

/** A saved dashboard-wide filter, shared by everyone on the deployment. */
export interface SavedSegment {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  kind: EntityKind;
  op: FilterOp;
  value: string;
  position: number;
}

const COLS = 'id, created_at, updated_at, name, kind, op, value, position';

export async function listSegments(): Promise<SavedSegment[]> {
  const { results } = await db().prepare(`SELECT ${COLS} FROM segments ORDER BY position, created_at`).all<SavedSegment>();
  return results;
}

export async function createSegment(input: { name: string; kind: EntityKind; op: FilterOp; value: string }): Promise<SavedSegment> {
  const id = nanoid();
  const pos = await db().prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM segments').first<{ p: number }>();
  await db()
    .prepare('INSERT INTO segments (id, name, kind, op, value, position) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, input.name, input.kind, input.op, input.value, pos?.p ?? 0)
    .run();
  const row = await db().prepare(`SELECT ${COLS} FROM segments WHERE id = ?`).bind(id).first<SavedSegment>();
  if (!row) throw new Error('Segment insert failed');
  return row;
}

export async function deleteSegment(id: string): Promise<void> {
  await db().prepare('DELETE FROM segments WHERE id = ?').bind(id).run();
}
