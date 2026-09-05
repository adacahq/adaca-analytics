import { describe, expect, it } from 'vitest';
import { DATASET_BY_KEY } from './catalog';
import { bucketExpr, rankedSql, timeseriesSql, totalsSql, weekdaySql } from './query-sql';

const pages = DATASET_BY_KEY['content.pages'];
const keyEvents = DATASET_BY_KEY['behaviour.keyEvents'];

describe('query-sql', () => {
  it('builds totals with the dataset window and family', () => {
    const s = totalsSql('s1', pages, '2026-08-01', '2026-08-31');
    expect(s.sql).toContain('FROM rollups WHERE site_id = ? AND report = ? AND date >= ? AND date <= ?');
    expect(s.params).toEqual(['s1', 'page', '2026-08-01', '2026-08-31']);
  });

  it('applies the dataset fixed filter and user filters with LIKE escaping', () => {
    const s = totalsSql('s1', keyEvents, '2026-08-01', '2026-08-31', [
      { dim: 'key1', op: 'contains', value: '50%_off' },
      { dim: 'key1', op: 'neq', value: 'purchase' },
      { dim: 'key2', op: 'eq', value: '' }, // empty → ignored
    ]);
    expect(s.sql).toContain('key2 = ?');
    expect(s.sql).toContain("key1 LIKE ? ESCAPE '\\'");
    expect(s.sql).toContain('key1 <> ?');
    expect(s.params).toEqual(['s1', 'event', '2026-08-01', '2026-08-31', '1', '%50\\%\\_off%', 'purchase']);
  });

  it('ranks by the metric expression with a bound limit and sub-dimension', () => {
    const s = rankedSql('s1', pages, '2026-08-01', '2026-08-31', { sortMetric: 'avgEngagementTime', dir: 'desc', limit: 10 });
    expect(s.sql).toContain('SELECT key1 AS name, key2 AS sub');
    expect(s.sql).toContain('GROUP BY key1, key2');
    expect(s.sql).toContain('ORDER BY CASE WHEN SUM(sessions) = 0');
    expect(s.params.at(-1)).toBe(10);
  });

  it('ranks key2 datasets on key2', () => {
    const s = rankedSql('s1', DATASET_BY_KEY['audience.cities'], '2026-08-01', '2026-08-31', { sortMetric: 'users', dir: 'desc', limit: 5 });
    expect(s.sql).toContain('SELECT key2 AS name');
    expect(s.sql).toContain('GROUP BY key2');
  });

  it('buckets time series', () => {
    expect(bucketExpr('day')).toBe('date');
    expect(bucketExpr('month')).toBe('substr(date, 1, 7)');
    expect(bucketExpr('week')).toContain("strftime('%w', date)");
    const s = timeseriesSql('s1', DATASET_BY_KEY['overview.totals'], '2026-01-01', '2026-08-31', 'week');
    expect(s.sql).toContain('GROUP BY 1 ORDER BY 1');
  });

  it('builds weekday breakdowns from totals', () => {
    const s = weekdaySql('s1', DATASET_BY_KEY['behaviour.weekdays'], '2026-08-01', '2026-08-31');
    expect(s.sql).toContain("strftime('%w', date) AS name");
    expect(s.params[1]).toBe('totals');
  });
});
