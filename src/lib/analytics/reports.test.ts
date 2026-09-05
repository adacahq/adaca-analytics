import { describe, expect, it } from 'vitest';
import { GA_METRICS, METRIC_COLUMNS, OTHER, PAIRS, REPORTS, SINGLES, capPerDay, gaDateToIso, mergeRows, normaliseKeys, referrerHost } from './reports';

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

  it('declares 17 pair families with two dimensions each, distinct from the 15 singles', () => {
    expect(SINGLES).toHaveLength(15);
    expect(PAIRS).toHaveLength(17);
    for (const p of PAIRS) expect(p.gaDimensions, p.key).toHaveLength(2);
    expect(new Set(REPORTS.map((r) => r.key)).size).toBe(REPORTS.length);
    expect(normaliseKeys('referrer_page', ['https://www.google.com/', '/about'])).toEqual({ key1: 'google.com', key2: '/about' });
  });

  it('caps rows per day and folds the rest into (other)', () => {
    const mk = (date: string, k: string, sessions: number, events: number) => ({ date, key1: k, key2: 'x', metrics: [1, 0, sessions, 0, 0, 0, 0, events] });
    const rows = [mk('d1', 'a', 5, 1), mk('d1', 'b', 9, 2), mk('d1', 'c', 1, 30), mk('d1', 'd', 2, 4), mk('d2', 'a', 3, 3)];
    const session = capPerDay(rows, 2, 'session');
    const d1 = session.filter((r) => r.date === 'd1');
    expect(d1.map((r) => r.key1)).toEqual(['b', 'a', OTHER]);
    expect(d1[2].metrics[2]).toBe(3); // c + d sessions
    expect(d1[2].metrics[7]).toBe(34); // c + d events
    expect(session.filter((r) => r.date === 'd2')).toHaveLength(1); // under the cap: untouched
    const event = capPerDay(rows, 1, 'event');
    expect(event.filter((r) => r.date === 'd1')[0].key1).toBe('c');
    expect(capPerDay(rows, 10, 'session')).toHaveLength(5);
  });

  it('converts GA dates', () => {
    expect(gaDateToIso('20260905')).toBe('2026-09-05');
    expect(gaDateToIso('2026-09-05')).toBe('2026-09-05');
  });
});
