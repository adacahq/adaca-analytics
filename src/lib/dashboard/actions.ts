'use server';

import { revalidatePath } from 'next/cache';
import { createDashboard, deleteDashboard, getDashboard, listDashboards, renameDashboard, saveLayout } from '@/lib/db/dashboards';
import { nanoid } from '@/lib/db/nanoid';
import { TEMPLATE_BY_KEY, cloneLayout } from './templates';
import { isChartType } from './widgets';
import type { WidgetInstance } from './types';

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Only shapes the grid can render get stored; anything else is dropped. */
function sanitise(layout: unknown): WidgetInstance[] {
  if (!Array.isArray(layout)) return [];
  const out: WidgetInstance[] = [];
  for (const it of layout as Partial<WidgetInstance>[]) {
    if (!it || typeof it.id !== 'string' || !isChartType(it.type)) continue;
    out.push({
      id: it.id.slice(0, 32),
      type: it.type,
      title: typeof it.title === 'string' ? it.title.slice(0, 120) : undefined,
      x: Math.max(0, Math.min(11, Math.round(Number(it.x) || 0))),
      y: Math.max(0, Math.round(Number(it.y) || 0)),
      w: Math.max(1, Math.min(12, Math.round(Number(it.w) || 1))),
      h: Math.max(1, Math.min(40, Math.round(Number(it.h) || 1))),
      config: typeof it.config === 'object' && it.config ? it.config : {},
    });
  }
  return out.slice(0, 80);
}

async function byId(id: string) {
  return (await listDashboards()).find((d) => d.id === id) ?? null;
}

export async function saveLayoutAction(dashboardId: string, layout: WidgetInstance[]): Promise<Result> {
  try {
    const d = await byId(dashboardId);
    if (!d) return { ok: false, error: 'Dashboard not found' };
    await saveLayout(d.id, sanitise(layout));
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed' };
  }
}

export async function createDashboardAction(input: { name: string; templateKey: string | null }): Promise<Result<{ slug: string }>> {
  try {
    const name = input.name.trim().slice(0, 80);
    if (!name) return { ok: false, error: 'Give the dashboard a name.' };
    const tpl = input.templateKey ? TEMPLATE_BY_KEY[input.templateKey] : null;
    const layout = tpl ? cloneLayout(tpl.layout, nanoid) : [];
    const d = await createDashboard({ name, kind: 'custom', template_key: tpl?.key ?? null, layout });
    revalidatePath('/', 'layout');
    return { ok: true, data: { slug: d.slug } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Create failed' };
  }
}

export async function renameDashboardAction(id: string, name: string): Promise<Result> {
  try {
    const clean = name.trim().slice(0, 80);
    if (!clean) return { ok: false, error: 'A name is required.' };
    await renameDashboard(id, clean);
    revalidatePath('/', 'layout');
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Rename failed' };
  }
}

export async function deleteDashboardAction(id: string): Promise<Result> {
  try {
    const d = await byId(id);
    if (!d) return { ok: false, error: 'Dashboard not found' };
    if (d.kind !== 'custom') return { ok: false, error: 'A default dashboard cannot be deleted. Reset it to its template instead.' };
    await deleteDashboard(id);
    revalidatePath('/', 'layout');
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete failed' };
  }
}

/** Restore a dashboard's layout from the template it was seeded from. */
export async function resetDashboardAction(id: string): Promise<Result<{ layout: WidgetInstance[] }>> {
  try {
    const d = await byId(id);
    if (!d) return { ok: false, error: 'Dashboard not found' };
    const tpl = d.template_key ? TEMPLATE_BY_KEY[d.template_key] : null;
    if (!tpl) return { ok: false, error: 'This dashboard was not created from a template.' };
    const layout = cloneLayout(tpl.layout, nanoid);
    await saveLayout(d.id, layout);
    return { ok: true, data: { layout } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Reset failed' };
  }
}

/** Copy any dashboard into a new custom one. */
export async function duplicateDashboardAction(id: string): Promise<Result<{ slug: string }>> {
  try {
    const d = await byId(id);
    if (!d) return { ok: false, error: 'Dashboard not found' };
    const copy = await createDashboard({ name: `${d.name} (copy)`, kind: 'custom', template_key: d.template_key, layout: cloneLayout(d.layout, nanoid) });
    revalidatePath('/', 'layout');
    return { ok: true, data: { slug: copy.slug } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Duplicate failed' };
  }
}

/** Fresh layout for a dashboard by slug (used after a reset to re-render without a full reload). */
export async function loadLayout(slug: string): Promise<WidgetInstance[]> {
  return (await getDashboard(slug))?.layout ?? [];
}
