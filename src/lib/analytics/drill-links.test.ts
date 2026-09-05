import { describe, expect, it } from 'vitest';
import { DATASET_BY_KEY, DATASETS, drillValue, filterKind, kpiDrill } from './catalog';
import { isEntityKind } from './entities';
import { bucketSpan } from './ranges';

describe('drill links from widgets', () => {
  it('opens the stored value, not the display label', () => {
    expect(drillValue(DATASET_BY_KEY['behaviour.hours'], { key: '07:00', raw: '07' })).toBe('07');
    expect(drillValue(DATASET_BY_KEY['audience.userType'], { key: 'New', raw: 'new' })).toBe('new');
    expect(drillValue(DATASET_BY_KEY['acquisition.sourceMedium'], { key: 'google', sub: 'organic', raw: 'google' })).toBe('google / organic');
    expect(drillValue(DATASET_BY_KEY['content.pages'], { key: '/pricing' })).toBe('/pricing');
  });

  it('names a real entity for every drill and key kind', () => {
    for (const ds of DATASETS) {
      if (ds.drill) expect(isEntityKind(ds.drill), ds.key).toBe(true);
      for (const k of Object.values(ds.keyKinds ?? {})) expect(isEntityKind(k), ds.key).toBe(true);
      if (ds.otherLabel) expect(ds.keyKinds?.[ds.dim === 'key1' ? 'key2' : 'key1'], `${ds.key} names its other side`).toBeTruthy();
    }
  });

  it('maps exact filters to the entity of the filtered key', () => {
    expect(filterKind(DATASET_BY_KEY['content.pages'], 'key1')).toBe('page');
    expect(filterKind(DATASET_BY_KEY['content.pages'], 'key2')).toBe('title');
    expect(filterKind(DATASET_BY_KEY['acquisition.sourceMedium'], 'key2')).toBe('medium');
    expect(filterKind(DATASET_BY_KEY['content.pagesBySource'], 'key1')).toBe('sourceMedium');
    expect(filterKind(DATASET_BY_KEY['behaviour.keyEvents'], 'key2')).toBeNull();
    expect(filterKind(DATASET_BY_KEY['overview.totals'], 'key1')).toBeNull();
  });

  it('links a KPI tile only when an exact filter names one entity', () => {
    const pages = DATASET_BY_KEY['content.pages'];
    expect(kpiDrill(pages, [{ dim: 'key1', op: 'eq', value: '/pricing' }])).toEqual({ kind: 'page', value: '/pricing' });
    expect(kpiDrill(pages, [{ dim: 'key1', op: 'contains', value: 'pric' }])).toBeNull();
    expect(kpiDrill(pages, [{ dim: 'key2', op: 'eq', value: '' }])).toBeNull();
    expect(kpiDrill(pages, undefined)).toBeNull();
    expect(kpiDrill(DATASET_BY_KEY['content.pagesBySource'], [{ dim: 'key1', op: 'eq', value: 'google / organic' }])).toEqual({ kind: 'sourceMedium', value: 'google / organic' });
    expect(kpiDrill(DATASET_BY_KEY['realtime.pages'], [{ dim: 'key1', op: 'eq', value: '/' }])).toBeNull();
  });
});

describe('bucketSpan', () => {
  const within = { from: '2026-08-09', to: '2026-09-05' };
  it('narrows to a day, a week or a month, clamped to the drawn period', () => {
    expect(bucketSpan('2026-08-20', 'day', within)).toEqual({ from: '2026-08-20', to: '2026-08-20' });
    expect(bucketSpan('2026-08-31', 'week', within)).toEqual({ from: '2026-08-31', to: '2026-09-05' });
    expect(bucketSpan('2026-08-03', 'week', within)).toEqual({ from: '2026-08-09', to: '2026-08-09' });
    expect(bucketSpan('2026-08', 'month', within)).toEqual({ from: '2026-08-09', to: '2026-08-31' });
    expect(bucketSpan('2026-09', 'month', { from: '2026-01-01', to: '2026-12-31' })).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
  it('refuses labels that are not calendar buckets or fall outside the period', () => {
    expect(bucketSpan('12', 'minute', within)).toBeNull();
    expect(bucketSpan('nope', 'day', within)).toBeNull();
    expect(bucketSpan('2026-07-01', 'day', within)).toBeNull();
  });
});
