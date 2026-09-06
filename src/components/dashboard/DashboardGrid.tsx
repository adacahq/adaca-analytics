'use client';

import 'react-grid-layout/css/styles.css';

import { useRef, useState, useTransition, type CSSProperties } from 'react';
import GridLayout, { useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import WidgetView from './WidgetView';
import WidgetBuilder, { type WidgetDraft } from './WidgetBuilder';
import DashboardMenu from './DashboardMenu';
import { WIDGET_BY_TYPE } from '@/lib/dashboard/widgets';
import { saveLayoutAction } from '@/lib/dashboard/actions';
import { nanoid } from '@/lib/db/nanoid';
import type { Dashboard, WidgetInstance } from '@/lib/dashboard/types';

/**
 * A dashboard: the header macro (title + the one primary action), the
 * grid, and edit mode. Widgets are pure data in `dashboard.layout`;
 * drag/resize/add/edit/remove all end in `saveLayoutAction`.
 *
 * Grid = react-grid-layout v2 (`useContainerWidth`, `gridConfig`/`dragConfig`/
 * `resizeConfig`); v1 needs `findDOMNode`, gone in React 19.
 */
export default function DashboardGrid({
  dashboard,
  siteId,
  hasRealtime,
  lede,
}: {
  dashboard: Dashboard;
  siteId: string;
  hasRealtime: boolean;
  lede: string;
}) {
  const [items, setItems] = useState<WidgetInstance[]>(dashboard.layout);
  const [editing, setEditing] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderInitial, setBuilderInitial] = useState<WidgetInstance | null>(null);
  const { width, containerRef, mounted } = useContainerWidth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const params = useSearchParams();
  const range = { range: params?.get('range'), from: params?.get('from'), to: params?.get('to'), compare: params?.get('compare'), seg: params?.get('seg') };

  function persist(next: WidgetInstance[]) {
    startTransition(async () => {
      const r = await saveLayoutAction(dashboard.id, next);
      if (!r.ok) toast.error(r.error);
    });
  }
  function saveNow(next: WidgetInstance[]) {
    if (timer.current) clearTimeout(timer.current);
    persist(next);
  }
  function saveSoon(next: WidgetInstance[]) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(next), 700);
  }

  const layout: Layout = items.map((it) => ({
    i: it.id,
    x: it.x,
    y: it.y,
    w: it.w,
    h: it.h,
    minW: WIDGET_BY_TYPE[it.type].minSize.w,
    minH: WIDGET_BY_TYPE[it.type].minSize.h,
  }));

  function onLayoutChange(next: Layout) {
    setItems((prev) => {
      const byId = new Map(next.map((li) => [li.i, li]));
      const merged = prev.map((it) => {
        const p = byId.get(it.id);
        return p ? { ...it, x: p.x, y: p.y, w: p.w, h: p.h } : it;
      });
      if (editing) saveSoon(merged);
      return merged;
    });
  }

  function openAdd() {
    setBuilderInitial(null);
    setBuilderOpen(true);
    setEditing(true);
  }
  function openEdit(it: WidgetInstance) {
    setBuilderInitial(it);
    setBuilderOpen(true);
  }
  function remove(id: string) {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    saveNow(next);
  }
  function duplicate(it: WidgetInstance) {
    const y = items.reduce((m, x) => Math.max(m, x.y + x.h), 0);
    const copy: WidgetInstance = { ...it, id: nanoid(), x: 0, y, title: it.title ? `${it.title} (copy)` : undefined, config: JSON.parse(JSON.stringify(it.config)) as WidgetInstance['config'] };
    const next = [...items, copy];
    setItems(next);
    saveNow(next);
  }
  /**
   * The stacked order: below 900px the grid gives way to one reading order.
   * It is its own field (`order`) so moving a widget on a phone never
   * disturbs the desktop layout; widgets without one follow the desktop
   * reading order (top-left first) and new widgets land at the end.
   */
  const ordered = [...items]
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (a.it.order ?? 1e6 + a.it.y * 100 + a.it.x) - (b.it.order ?? 1e6 + b.it.y * 100 + b.it.x) || a.i - b.i)
    .map((x) => x.it);
  const reading = ordered.map((it) => it.id);
  function move(id: string, dir: -1 | 1) {
    const i = reading.indexOf(id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= reading.length) return;
    const seq = [...reading];
    [seq[i], seq[j]] = [seq[j], seq[i]];
    const pos = new Map(seq.map((k, n) => [k, n]));
    const next = items.map((it) => ({ ...it, order: pos.get(it.id) ?? it.order }));
    setItems(next);
    saveNow(next);
  }

  function submit(draft: WidgetDraft) {
    if (builderInitial) {
      const next = items.map((it) => (it.id === builderInitial.id ? { ...it, type: draft.type, title: draft.title, config: draft.config } : it));
      setItems(next);
      saveNow(next);
    } else {
      const meta = WIDGET_BY_TYPE[draft.type];
      const y = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
      const inst: WidgetInstance = { id: nanoid(), type: draft.type, title: draft.title, x: 0, y, w: meta.defaultSize.w, h: meta.defaultSize.h, config: draft.config };
      const next = [...items, inst];
      setItems(next);
      saveNow(next);
    }
  }
  function toggleEditing() {
    setEditing((e) => {
      const nextEditing = !e;
      if (!nextEditing) saveNow(items);
      return nextEditing;
    });
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <h1 className="view-title rv">{dashboard.name}</h1>
        <span className="rv flex items-center gap-2" style={{ '--i': 1 } as CSSProperties}>
          {editing ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={openAdd}>
                + Add widget
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={toggleEditing}>
                Done
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={toggleEditing}>
                Customise
              </button>
              <DashboardMenu
                dashboard={dashboard}
                onReset={(layout) => {
                  setItems(layout);
                  router.refresh();
                }}
              />
            </>
          )}
        </span>
      </div>
      <p className="lede rv" style={{ '--i': 1 } as CSSProperties}>
        {lede}
      </p>

      <div className="mt-8">
        {items.length === 0 ? (
          <div className="empty">
            <span className="zone-label">Dashboard</span>
            <h3 className="mt-3.5" style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--fg)' }}>
              This dashboard is empty
            </h3>
            <p>Add numbers, charts, lists and tables from your analytics data — pick the data type, the specific data, then how to chart it.</p>
            <button type="button" className="btn btn-primary btn-sm mt-5" onClick={openAdd}>
              + Add your first widget
            </button>
          </div>
        ) : (
          <div ref={containerRef}>
            {mounted && (
              <GridLayout
                width={width}
                layout={layout}
                /* containerPadding [0,0]: RGL defaults it to `margin`, which insets the
                   whole grid by 14px and leaves the widgets sitting inboard of the
                   masthead. Zero it so the first column's left edge and the last
                   column's right edge line up with the title and the lede. */
                gridConfig={{ cols: 12, rowHeight: 96, margin: [14, 14] as const, containerPadding: [0, 0] as const }}
                dragConfig={{ enabled: editing, handle: '.widget-drag', cancel: 'button, a, input, textarea, select' }}
                resizeConfig={{ enabled: editing, handles: ['se'] as const }}
                onLayoutChange={onLayoutChange}
              >
                {ordered.map((it) => (
                  <div key={it.id} data-type={it.type} data-wide={it.w >= 5 ? '1' : undefined}>
                    <WidgetView
                      siteId={siteId}
                      instance={it}
                      range={range}
                      editing={editing}
                      onEdit={() => openEdit(it)}
                      onDuplicate={() => duplicate(it)}
                      onRemove={() => remove(it.id)}
                      onMove={(dir) => move(it.id, dir)}
                      canMove={[reading.indexOf(it.id) > 0, reading.indexOf(it.id) < reading.length - 1]}
                    />
                  </div>
                ))}
              </GridLayout>
            )}
          </div>
        )}
      </div>

      <WidgetBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} initial={builderInitial} onSubmit={submit} hasRealtime={hasRealtime} />
    </div>
  );
}
