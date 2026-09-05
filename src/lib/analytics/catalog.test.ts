import { describe, expect, it } from 'vitest';
import { CATEGORIES, DATASETS, DATASET_BY_KEY, datasetsIn } from './catalog';
import { METRIC_BY_KEY, METRICS, metricSql, metricValue } from './metrics';
import { REPORT_BY_KEY } from './reports';

describe('catalog', () => {
  it('every dataset points at a real family or realtime report, with known metrics and charts', () => {
    for (const d of DATASETS) {
      expect(CATEGORIES.some((c) => c.key === d.category), d.key).toBe(true);
      if (!d.live) expect(REPORT_BY_KEY[d.report as keyof typeof REPORT_BY_KEY], d.key).toBeTruthy();
      expect(d.metrics.length, d.key).toBeGreaterThan(0);
      for (const m of d.metrics) expect(METRIC_BY_KEY[m], `${d.key} ${m}`).toBeTruthy();
      expect(d.metrics).toContain(d.defaultMetric);
      expect(d.charts.length, d.key).toBeGreaterThan(0);
      expect(d.key.startsWith(`${d.category}.`)).toBe(true);
    }
  });

  it('every category has at least one dataset', () => {
    for (const c of CATEGORIES) expect(datasetsIn(c.key).length, c.key).toBeGreaterThan(0);
  });

  it('keys are unique', () => {
    expect(Object.keys(DATASET_BY_KEY)).toHaveLength(DATASETS.length);
  });
});

describe('metrics', () => {
  const sums = { users: 100, new_users: 40, sessions: 200, engaged_sessions: 150, pageviews: 600, engagement_seconds: 9000, key_events: 10, event_count: 2000 };

  it('derives ratios from sums', () => {
    expect(metricValue('users', sums)).toBe(100);
    expect(metricValue('engagementRate', sums)).toBeCloseTo(0.75);
    expect(metricValue('bounceRate', sums)).toBeCloseTo(0.25);
    expect(metricValue('avgEngagementTime', sums)).toBe(45);
    expect(metricValue('viewsPerSession', sums)).toBe(3);
    expect(metricValue('keyEventRate', sums)).toBe(0.05);
    expect(metricValue('engagementRate', { sessions: 0 })).toBe(0);
  });

  it('formats for display', () => {
    expect(METRIC_BY_KEY.users.format(12345)).toBe('12,345');
    expect(METRIC_BY_KEY.users.format(12345, true)).toBe('12k');
    expect(METRIC_BY_KEY.engagementRate.format(0.7512)).toBe('75.1%');
    expect(METRIC_BY_KEY.avgEngagementTime.format(125)).toBe('2m 05s');
  });

  it('produces SQL for sums and ratios', () => {
    expect(metricSql('sessions')).toBe('SUM(sessions)');
    expect(metricSql('bounceRate')).toContain('(1 - CASE WHEN SUM(sessions) = 0');
    expect(metricSql('avgEngagementTime', 'r')).toContain('SUM(r.engagement_seconds)');
    for (const m of METRICS) expect(metricSql(m.key)).toBeTruthy();
  });
});
