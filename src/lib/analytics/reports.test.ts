import { describe, expect, it } from 'vitest';
import { GA_METRICS, METRIC_COLUMNS, REPORTS, gaDateToIso, mergeRows, normaliseKeys, referrerHost } from './reports';

describe('report families', () => {
  it('keeps metric columns and GA metrics positionally aligned', () => {
    expect(GA_METRICS.length).toBe(METRIC_COLUMNS.length);
  });

  it('declares one or two keys per family, matching its GA dimensions', () => {
    for (const r of REPORTS) {
      expect(r.keyLabels.length).toBe(r.gaDimensions.length);
      expect(r.gaDimensions.length).toBeLessThanOrEqual(2);
    }
  });

  it('normalises referrers to bare hosts', () => {
    expect(referrerHost('https://www.google.com/search?q=x')).toBe('google.com');
    expect(referrerHost('android-app://com.slack/')).toBe('com.slack');
    expect(referrerHost('(not set)')).toBe('(direct)');
    expect(referrerHost('')).toBe('(direct)');
    expect(referrerHost('news.ycombinator.com')).toBe('news.ycombinator.com');
  });

  it('normalises keys per family', () => {
    expect(normaliseKeys('totals', [])).toEqual({ key1: '', key2: '' });
    expect(normaliseKeys('event', ['purchase', 'true'])).toEqual({ key1: 'purchase', key2: '1' });
    expect(normaliseKeys('event', ['scroll', 'false'])).toEqual({ key1: 'scroll', key2: '0' });
    expect(normaliseKeys('hour', ['7'])).toEqual({ key1: '07', key2: '' });
    expect(normaliseKeys('page', ['/about', 'About us'])).toEqual({ key1: '/about', key2: 'About us' });
  });

  it('merges rows that share a key after normalisation', () => {
    const merged = mergeRows([
      { date: '2026-09-01', key1: 'google.com', key2: '', metrics: [1, 0, 2, 1, 3, 10, 0, 5] },
      { date: '2026-09-01', key1: 'google.com', key2: '', metrics: [2, 1, 1, 0, 1, 5, 1, 2] },
      { date: '2026-09-02', key1: 'google.com', key2: '', metrics: [1, 1, 1, 1, 1, 1, 1, 1] },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].metrics).toEqual([3, 1, 3, 1, 4, 15, 1, 7]);
  });

  it('converts GA dates', () => {
    expect(gaDateToIso('20260905')).toBe('2026-09-05');
    expect(gaDateToIso('2026-09-05')).toBe('2026-09-05');
  });
});
