import { describe, expect, it } from 'vitest';
import { TEMPLATES, cloneLayout } from './templates';
import { WIDGET_BY_TYPE } from './widgets';
import { DATASET_BY_KEY } from '@/lib/analytics/catalog';
import { isMetricKey } from '@/lib/analytics/metrics';

describe('dashboard templates', () => {
  it('has the six defaults in order', () => {
    expect(TEMPLATES.map((t) => t.slug)).toEqual(['home', 'realtime', 'acquisition', 'content', 'audience', 'behaviour']);
    expect(TEMPLATES.map((t) => t.position)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('every widget references a real dataset, an allowed metric and an allowed chart, inside a 12-column grid', () => {
    for (const t of TEMPLATES) {
      const ids = new Set<string>();
      for (const it of t.layout) {
        expect(ids.has(it.id), `${t.key} duplicate id ${it.id}`).toBe(false);
        ids.add(it.id);
        const meta = WIDGET_BY_TYPE[it.type];
        expect(meta, `${t.key} ${it.id} type`).toBeTruthy();
        expect(it.x + it.w, `${t.key} ${it.title} width`).toBeLessThanOrEqual(12);
        expect(it.w, `${t.key} ${it.title} minW`).toBeGreaterThanOrEqual(meta.minSize.w);
        expect(it.h, `${t.key} ${it.title} minH`).toBeGreaterThanOrEqual(meta.minSize.h);
        if (!meta.needsData) continue;
        const ds = DATASET_BY_KEY[it.config.dataset ?? ''];
        expect(ds, `${t.key} ${it.title} dataset ${it.config.dataset}`).toBeTruthy();
        expect(ds.charts, `${t.key} ${it.title} chart ${it.type}`).toContain(it.type);
        expect(isMetricKey(it.config.metric) && ds.metrics.includes(it.config.metric), `${t.key} ${it.title} metric ${it.config.metric}`).toBe(true);
        for (const m of it.config.metrics ?? []) expect(isMetricKey(m) && ds.metrics.includes(m), `${t.key} ${it.title} column ${m}`).toBe(true);
      }
    }
  });

  it('widgets never overlap', () => {
    for (const t of TEMPLATES) {
      const cells = new Set<string>();
      for (const it of t.layout) {
        for (let x = it.x; x < it.x + it.w; x++) {
          for (let y = it.y; y < it.y + it.h; y++) {
            const k = `${x},${y}`;
            expect(cells.has(k), `${t.key}: ${it.title} overlaps at ${k}`).toBe(false);
            cells.add(k);
          }
        }
      }
    }
  });

  it('clones with fresh ids and detached config', () => {
    let n = 0;
    const copy = cloneLayout(TEMPLATES[0].layout, () => `n${n++}`);
    expect(copy[0].id).toBe('n0');
    expect(copy[0].config).not.toBe(TEMPLATES[0].layout[0].config);
    expect(copy[0].config).toEqual(TEMPLATES[0].layout[0].config);
  });
});
