import { describe, expect, it } from 'vitest';
import { DATASET_BY_KEY } from './catalog';
import { bucketExpr, hourlySql, rankedSql, timeseriesSql, totalsSql, weekdaySql } from './query-sql';
import { scopeFor, segmentScope, type Scope } from './segments';
import type { Filter } from '@/lib/dashboard/types';

const pages = DATASET_BY_KEY['content.pages'];
const keyEvents = DATASET_BY_KEY['behaviour.keyEvents'];

function plain(key: string, filters: Filter[] = []): Scope {
  const r = scopeFor(DATASET_BY_KEY[key], null, filters);
  if (!r.ok) throw new Error(r.reason);
  return r.scope;
}

describe('query-sql', () => {
  it('builds totals with the dataset window and family', () => {
    const s = totalsSql('s1', plain('content.pages'), '2026-08-01', '2026-08-31');
    expect(s.sql).toContain('FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ?');
    expect(s.params).toEqual(['s1', 'page', '2026-08-01', '2026-08-31']);
  });

  it('applies the dataset fixed filter and user filters with LIKE escaping', () => {
    const s = totalsSql(
      's1',
      plain('behaviour.keyEvents', [
        { dim: 'key1', op: 'contains', value: '50%_off' },
        { dim: 'key1', op: 'neq', value: 'purchase' },
        { dim: 'key2', op: 'eq', value: '' }, // empty → ignored
      ]),
      '2026-08-01',
      '2026-08-31',
    );
    expect(s.sql).toContain('key2 = ?');
    expect(s.sql).toContain("key1 LIKE ? ESCAPE '\\'");
    expect(s.sql).toContain('key1 <> ?');
    expect(s.params).toEqual(['s1', 'event', '2026-08-01', '2026-08-31', '1', '%50\\%\\_off%', 'purchase']);
    expect(keyEvents.where).toEqual({ dim: 'key2', value: '1' });
  });

  it('ranks by the metric expression with a bound limit and sub-dimension', () => {
    const s = rankedSql('s1', plain('content.pages'), '2026-08-01', '2026-08-31', { sortMetric: 'avgEngagementTime', dir: 'desc', limit: 10 });
    expect(s.sql).toContain('SELECT key1 AS name, key2 AS sub');
    expect(s.sql).toContain('GROUP BY key1, key2');
    expect(s.sql).toContain('ORDER BY CASE WHEN SUM(sessions) = 0');
    expect(s.params.at(-1)).toBe(10);
    expect(pages.subDim).toBe('key2');
  });

  it('ranks key2 datasets on key2', () => {
    const s = rankedSql('s1', plain('audience.cities'), '2026-08-01', '2026-08-31', { sortMetric: 'users', dir: 'desc', limit: 5 });
    expect(s.sql).toContain('SELECT key2 AS name');
    expect(s.sql).toContain('GROUP BY key2');
  });

  it('buckets time series, and reads hours from the hour family', () => {
    expect(bucketExpr('day')).toBe('date');
    expect(bucketExpr('month')).toBe('substr(date, 1, 7)');
    expect(bucketExpr('week')).toContain("strftime('%w', date)");
    const s = timeseriesSql('s1', plain('overview.totals'), '2026-01-01', '2026-08-31', 'week');
    expect(s.sql).toContain('GROUP BY 1 ORDER BY 1');
    const h = hourlySql('s1', '2026-09-05', '2026-09-06');
    expect(h.sql).toContain("date || 'T' || key1 AS name");
    expect(h.sql).toContain("report = 'hour'");
  });

  it('builds weekday breakdowns from totals', () => {
    const s = weekdaySql('s1', plain('behaviour.weekdays'), '2026-08-01', '2026-08-31');
    expect(s.sql).toContain("strftime('%w', date) AS name");
    expect(s.params[1]).toBe('totals');
  });

  describe('under a segment', () => {
    it('sums a segment from its own family with an exact key match', () => {
      const s = totalsSql('s1', segmentScope({ kind: 'source', op: 'eq', value: 'google' }), '2026-08-01', '2026-08-31');
      expect(s.sql).toContain('report = ? AND date >= ? AND date <= ? AND key1 = ?');
      expect(s.params).toEqual(['s1', 'source', '2026-08-01', '2026-08-31', 'google']);
    });

    it('matches a source inside the stored "source / medium" and drops the fold row', () => {
      const r = scopeFor(DATASET_BY_KEY['content.landing'], { kind: 'source', op: 'eq', value: 'google' });
      if (!r.ok) throw new Error(r.reason);
      expect(r.scope.report).toBe('sm_landing');
      expect(r.scope.dim).toBe('key2');
      const s = rankedSql('s1', r.scope, '2026-08-01', '2026-08-31', { sortMetric: 'sessions', dir: 'desc', limit: 10 });
      expect(s.sql).toContain("substr(key1, 1, instr(key1, ' / ') - 1) ELSE key1 END = ?");
      expect(s.sql).toContain('key2 <> ?');
      expect(s.params).toEqual(['s1', 'sm_landing', '2026-08-01', '2026-08-31', 'google', '(other)', 10]);
    });

    it('splits "source / medium" when a pair must show bare sources', () => {
      const r = scopeFor(DATASET_BY_KEY['acquisition.sources'], { kind: 'landing', op: 'eq', value: '/pricing' });
      if (!r.ok) throw new Error(r.reason);
      expect(r.scope.report).toBe('sm_landing');
      const s = rankedSql('s1', r.scope, '2026-08-01', '2026-08-31', { sortMetric: 'sessions', dir: 'desc', limit: 10 });
      expect(s.sql).toMatch(/SELECT CASE WHEN instr\(key1, ' \/ '\) > 0 THEN substr\(key1, 1, instr\(key1, ' \/ '\) - 1\) ELSE key1 END AS name/);
      expect(s.sql).toContain('key2 = ?');
    });

    it('keeps key-event datasets to key events through the event family', () => {
      const r = scopeFor(keyEvents, { kind: 'page', op: 'eq', value: '/' });
      if (!r.ok) throw new Error(r.reason);
      expect(r.scope.report).toBe('page_event');
      expect(r.scope.keyEventsOn).toBe('key2');
      const s = rankedSql('s1', r.scope, '2026-08-01', '2026-08-31', { sortMetric: 'keyEvents', dir: 'desc', limit: 10 });
      expect(s.sql).toContain("key2 IN (SELECT key1 FROM rollups WHERE site_id = ? AND report = 'event' AND key2 = '1'");
    });

    it('applies contains / is not to the split expression', () => {
      const r = scopeFor(DATASET_BY_KEY['content.pages'], { kind: 'medium', op: 'not_contains', value: 'cpc' });
      if (!r.ok) throw new Error(r.reason);
      const s = totalsSql('s1', r.scope, '2026-08-01', '2026-08-31');
      expect(s.sql).toContain("instr(key1, ' / ') + 3) ELSE '(none)' END NOT LIKE ? ESCAPE '\\'");
      expect(s.params).toContain('%cpc%');
    });
  });
});
