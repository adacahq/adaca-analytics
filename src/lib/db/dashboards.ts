import { db } from './client';
import { nanoid } from './nanoid';
import type { Dashboard, DashboardKind, WidgetInstance } from '@/lib/dashboard/types';

interface Row {
  id: string;
  created_at: string;
  updated_at: string;
  slug: string;
  name: string;
  kind: DashboardKind;
  template_key: string | null;
  position: number;
  layout: string;
}

const COLS = 'id, created_at, updated_at, slug, name, kind, template_key, position, layout';

function parse(row: Row): Dashboard {
  let layout: WidgetInstance[] = [];
  try {
    const v = JSON.parse(row.layout) as unknown;
    if (Array.isArray(v)) layout = v as WidgetInstance[];
  } catch {
    layout = [];
  }
  return { ...row, layout };
}

export async function listDashboards(): Promise<Dashboard[]> {
  const { results } = await db()
    .prepare(`SELECT ${COLS} FROM dashboards WHERE deleted_at IS NULL ORDER BY kind DESC, position, created_at`)
    .all<Row>();
  return results.map(parse);
}

export async function getDashboard(slug: string): Promise<Dashboard | null> {
  const row = await db().prepare(`SELECT ${COLS} FROM dashboards WHERE slug = ? AND deleted_at IS NULL`).bind(slug).first<Row>();
  return row ? parse(row) : null;
}

export async function getDashboardById(id: string): Promise<Dashboard | null> {
  const row = await db().prepare(`SELECT ${COLS} FROM dashboards WHERE id = ? AND deleted_at IS NULL`).bind(id).first<Row>();
  return row ? parse(row) : null;
}

export async function countDashboards(): Promise<number> {
  const r = await db().prepare('SELECT COUNT(*) AS n FROM dashboards WHERE deleted_at IS NULL').first<{ n: number }>();
  return r?.n ?? 0;
}

export interface NewDashboard {
  slug?: string;
  name: string;
  kind: DashboardKind;
  template_key?: string | null;
  position?: number;
  layout: WidgetInstance[];
}

export async function createDashboard(input: NewDashboard): Promise<Dashboard> {
  const id = nanoid();
  const slug = input.slug ?? id;
  const pos =
    input.position ??
    ((await db().prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM dashboards WHERE kind = ?').bind(input.kind).first<{ p: number }>())?.p ?? 0);
  await db()
    .prepare('INSERT INTO dashboards (id, slug, name, kind, template_key, position, layout) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, slug, input.name, input.kind, input.template_key ?? null, pos, JSON.stringify(input.layout))
    .run();
  const d = await getDashboard(slug);
  if (!d) throw new Error('Dashboard insert failed');
  return d;
}

export async function saveLayout(id: string, layout: WidgetInstance[]): Promise<void> {
  await db().prepare('UPDATE dashboards SET layout = ? WHERE id = ?').bind(JSON.stringify(layout), id).run();
}

export async function renameDashboard(id: string, name: string): Promise<void> {
  await db().prepare('UPDATE dashboards SET name = ? WHERE id = ?').bind(name, id).run();
}

export async function deleteDashboard(id: string): Promise<void> {
  // Custom dashboards only; defaults are reset, never deleted (enforced by the caller).
  await db().prepare("UPDATE dashboards SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND kind = 'custom'").bind(id).run();
}
