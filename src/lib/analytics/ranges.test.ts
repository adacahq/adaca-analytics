import { describe, expect, it } from 'vitest';
import {
  addDays,
  autoBucket,
  compareCaption,
  compareNoun,
  comparisonPeriod,
  daysBetween,
  eachHour,
  endOfMonth,
  isHourly,
  previousPeriod,
  rangeToQuery,
  resolveRange,
  startOfWeek,
  todayInZone,
} from './ranges';

const TODAY = '2026-09-05';

describe('ranges', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('counts inclusive days', () => {
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(1);
    expect(daysBetween('2026-09-01', '2026-09-07')).toBe(7);
  });

  it('resolves presets relative to today', () => {
    expect(resolveRange({ range: 'today' }, TODAY)).toMatchObject({ from: TODAY, to: TODAY });
    expect(resolveRange({ range: 'yesterday' }, TODAY)).toMatchObject({ from: '2026-09-04', to: '2026-09-04' });
    expect(resolveRange({ range: '7d' }, TODAY)).toMatchObject({ from: '2026-08-29', to: '2026-09-04' });
    expect(resolveRange({ range: '28d' }, TODAY)).toMatchObject({ from: '2026-08-08', to: '2026-09-04' });
    expect(resolveRange({ range: 'month' }, TODAY)).toMatchObject({ from: '2026-09-01', to: TODAY });
    expect(resolveRange({ range: 'last-month' }, TODAY)).toMatchObject({ from: '2026-08-01', to: '2026-08-31' });
    expect(resolveRange({ range: '12m' }, TODAY)).toMatchObject({ from: '2025-09-06', to: '2026-09-04' });
  });

  it('falls back to the default preset on bad input', () => {
    expect(resolveRange({ range: 'nope' }, TODAY).key).toBe('28d');
    expect(resolveRange({ from: '2026-13-99', to: 'x' }, TODAY).key).toBe('28d');
  });

  it('accepts custom bounds in either order', () => {
    const r = resolveRange({ from: '2026-03-10', to: '2026-03-01', compare: '1' }, TODAY);
    expect(r).toMatchObject({ key: 'custom', from: '2026-03-01', to: '2026-03-10', compare: 'prev', against: { from: '2026-02-19', to: '2026-02-28' } });
  });

  it('offers year to date and all time', () => {
    expect(resolveRange({ range: 'ytd' }, TODAY)).toMatchObject({ from: '2026-01-01', to: TODAY });
    expect(resolveRange({ range: 'all' }, TODAY, { earliest: '2025-11-20' })).toMatchObject({ from: '2025-11-20', to: TODAY });
    // No rows yet: the last twelve months stand in.
    expect(resolveRange({ range: 'all' }, TODAY, { earliest: null })).toMatchObject({ from: '2025-09-06', to: TODAY });
  });

  it('compares against the period before, the year before, or any window', () => {
    const base = { range: '7d' };
    expect(resolveRange({ ...base, compare: 'prev' }, TODAY)).toMatchObject({ compare: 'prev', against: { from: '2026-08-22', to: '2026-08-28' } });
    expect(resolveRange({ ...base, compare: 'yoy' }, TODAY)).toMatchObject({ compare: 'yoy', against: { from: '2025-08-29', to: '2025-09-04' } });
    expect(resolveRange({ ...base, compare: '2026-01-01..2026-01-07' }, TODAY)).toMatchObject({ compare: 'custom', against: { from: '2026-01-01', to: '2026-01-07' } });
    expect(resolveRange({ ...base, compare: 'nope' }, TODAY)).toMatchObject({ compare: null, against: null });
    const yoy = resolveRange({ ...base, compare: 'yoy' }, TODAY);
    expect(comparisonPeriod(yoy)).toEqual(yoy.against);
    expect(comparisonPeriod(resolveRange(base, TODAY))).toEqual(previousPeriod(resolveRange(base, TODAY)));
    expect(compareNoun(yoy)).toBe('the same period last year');
    expect(compareNoun(resolveRange({ ...base, compare: '2026-01-01..2026-01-07' }, TODAY))).toBe('2026-01-01 to 2026-01-07');
    expect(compareCaption('yoy')).toBe('vs last year');
    expect(isHourly({ from: TODAY, to: TODAY })).toBe(true);
    expect(isHourly({ from: '2026-09-01', to: TODAY })).toBe(false);
    expect(eachHour('2026-09-05', '2026-09-05', 2)).toEqual(['2026-09-05T00', '2026-09-05T01', '2026-09-05T02']);
  });

  it('computes the previous period of equal length', () => {
    expect(previousPeriod({ from: '2026-09-01', to: '2026-09-07' })).toEqual({ from: '2026-08-25', to: '2026-08-31' });
    expect(previousPeriod({ from: TODAY, to: TODAY })).toEqual({ from: '2026-09-04', to: '2026-09-04' });
  });

  it('round-trips through a query string', () => {
    const r = resolveRange({ range: '90d', compare: '1' }, TODAY);
    const q = rangeToQuery(r);
    expect(q.get('range')).toBe('90d');
    expect(q.get('compare')).toBe('prev');
    expect(resolveRange(Object.fromEntries(q), TODAY)).toEqual(r);
    const c = resolveRange({ range: '7d', compare: '2026-01-01..2026-01-07' }, TODAY);
    expect(rangeToQuery(c).get('compare')).toBe('2026-01-01..2026-01-07');
    expect(resolveRange(Object.fromEntries(rangeToQuery(c)), TODAY)).toEqual(c);
    // The default preset is omitted so plain links stay clean.
    expect(rangeToQuery(resolveRange({}, TODAY)).toString()).toBe('');
  });

  it('knows month ends and Monday weeks', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
    expect(startOfWeek('2026-09-05')).toBe('2026-08-31'); // Saturday → Monday
    expect(startOfWeek('2026-08-31')).toBe('2026-08-31');
  });

  it('picks a bucket by span', () => {
    expect(autoBucket({ from: '2026-08-08', to: '2026-09-04' })).toBe('day');
    expect(autoBucket({ from: '2026-01-01', to: '2026-09-04' })).toBe('week');
    expect(autoBucket({ from: '2024-01-01', to: '2026-09-04' })).toBe('month');
  });

  it('reads today in a zone', () => {
    // 2026-09-05T13:30Z is already the 5th in Sydney (+10) and the 5th in UTC,
    // but 2026-09-05T15:30Z is the 6th in Sydney.
    expect(todayInZone('Australia/Sydney', new Date('2026-09-05T13:30:00Z'))).toBe('2026-09-05');
    expect(todayInZone('Australia/Sydney', new Date('2026-09-05T15:30:00Z'))).toBe('2026-09-06');
    expect(todayInZone('America/Los_Angeles', new Date('2026-09-05T03:30:00Z'))).toBe('2026-09-04');
  });
});
