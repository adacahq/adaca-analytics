import { describe, expect, it } from 'vitest';
import { DATASETS, DATASET_BY_KEY } from './catalog';
import { ENTITIES } from './entities';
import { FULL_SEGMENT_KINDS, familySides, parseSegment, scopeFor, segmentLabel, segmentParam } from './segments';

describe('segments', () => {
  it('round-trips through the URL param and labels itself', () => {
    const seg = { kind: 'page' as const, op: 'contains' as const, value: '/blog:2026' };
    expect(parseSegment(segmentParam(seg))).toEqual(seg);
    expect(segmentLabel({ kind: 'source', op: 'eq', value: 'google' })).toBe('Source is google');
    expect(parseSegment('nope:eq:x')).toBeNull();
    expect(parseSegment('page:eq:')).toBeNull();
    expect(parseSegment('page:like:x')).toBeNull();
    expect(parseSegment(null)).toBeNull();
  });

  it('knows which entity each key of a family holds', () => {
    expect(familySides('source')).toEqual(['source', 'medium']);
    expect(familySides('sm_landing')).toEqual(['sourceMedium', 'landing']);
    expect(familySides('event')).toEqual(['event', null]);
    expect(familySides('totals')).toEqual([null, null]);
  });

  it('reads totals from the segment kind’s own family', () => {
    const r = scopeFor(DATASET_BY_KEY['overview.totals'], { kind: 'medium', op: 'eq', value: 'organic' });
    expect(r).toMatchObject({ ok: true, scope: { report: 'source', dim: 'none', segment: { side: 'key2', match: 'eq' } } });
    const sm = scopeFor(DATASET_BY_KEY['behaviour.weekdays'], { kind: 'sourceMedium', op: 'eq', value: 'google / organic' });
    expect(sm).toMatchObject({ ok: true, scope: { report: 'source', segment: { side: 'key1', match: 'sourceMedium' } } });
  });

  it('stays on the dataset’s family when the segment lives on its other key', () => {
    expect(scopeFor(DATASET_BY_KEY['acquisition.sources'], { kind: 'medium', op: 'eq', value: 'organic' })).toMatchObject({ ok: true, scope: { report: 'source', dim: 'key1', segment: { side: 'key2' } } });
    expect(scopeFor(DATASET_BY_KEY['audience.countries'], { kind: 'city', op: 'eq', value: 'Sydney' })).toMatchObject({ ok: true, scope: { report: 'geo', segment: { side: 'key2' } } });
    expect(scopeFor(DATASET_BY_KEY['content.pagesBySource'], { kind: 'source', op: 'eq', value: 'google' })).toMatchObject({ ok: true, scope: { report: 'sm_page', dim: 'key2', segment: { side: 'key1', match: 'source' } } });
    // The shown dimension itself: the list narrows to the matching values.
    expect(scopeFor(DATASET_BY_KEY['content.pages'], { kind: 'page', op: 'contains', value: '/blog' })).toMatchObject({ ok: true, scope: { report: 'page', segment: { side: 'key1', match: 'eq', op: 'contains' } } });
  });

  it('reroutes to the pair family that stores both dimensions', () => {
    expect(scopeFor(DATASET_BY_KEY['content.landing'], { kind: 'channel', op: 'eq', value: 'Organic Search' })).toMatchObject({ ok: true, scope: { report: 'channel_landing', dim: 'key2', segment: { side: 'key1' } } });
    expect(scopeFor(DATASET_BY_KEY['acquisition.channels'], { kind: 'source', op: 'eq', value: 'google' })).toMatchObject({ ok: true, scope: { report: 'channel_sm', dim: 'key1', segment: { side: 'key2', match: 'source' } } });
    expect(scopeFor(DATASET_BY_KEY['audience.devices'], { kind: 'country', op: 'eq', value: 'Australia' })).toMatchObject({ ok: true, scope: { report: 'country_device', dim: 'key2' } });
    expect(scopeFor(DATASET_BY_KEY['acquisition.sourceMedium'], { kind: 'page', op: 'eq', value: '/' })).toMatchObject({ ok: true, scope: { report: 'sm_page', dim: 'key1', dimExpr: 'key1' } });
  });

  it('explains what it cannot serve', () => {
    expect(scopeFor(DATASET_BY_KEY['audience.browsers'], { kind: 'source', op: 'eq', value: 'google' })).toMatchObject({ ok: false });
    expect(scopeFor(DATASET_BY_KEY['content.pagesBySource'], { kind: 'country', op: 'eq', value: 'Australia' })).toMatchObject({ ok: false });
    expect(scopeFor(DATASET_BY_KEY['realtime.pages'], { kind: 'country', op: 'eq', value: 'Australia' })).toMatchObject({ ok: false });
    expect(scopeFor(DATASET_BY_KEY['content.pages'], { kind: 'source', op: 'eq', value: 'google' }, [{ dim: 'key2', op: 'eq', value: 'Home' }])).toMatchObject({ ok: false });
  });

  it('serves every full segment kind to every single-dimension dataset of the entity registry, or says why not', () => {
    for (const kind of FULL_SEGMENT_KINDS) {
      for (const ds of DATASETS.filter((d) => !d.live && d.dim !== 'none')) {
        const r = scopeFor(ds, { kind, op: 'eq', value: 'x' });
        if (r.ok) expect(r.scope.report, `${ds.key} × ${kind}`).toBeTruthy();
        else expect(r.reason.length, `${ds.key} × ${kind}`).toBeGreaterThan(0);
      }
    }
    // Every entity kind is a valid segment kind.
    for (const e of ENTITIES) expect(parseSegment(`${e.kind}:eq:v`)?.kind).toBe(e.kind);
  });
});
