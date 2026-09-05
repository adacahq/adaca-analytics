/**
 * Date ranges — pure. Every date here is a calendar day 'YYYY-MM-DD' in the
 * property's reporting timezone, which is also how GA labels rollup rows.
 * Nothing reads the machine clock or zone except `todayInZone`, which is
 * given both explicitly.
 */

export type RangeKey =
  | 'today'
  | 'yesterday'
  | '7d'
  | '28d'
  | '90d'
  | 'month'
  | 'last-month'
  | '12m'
  | 'custom';

export interface DateRange {
  key: RangeKey;
  from: string;
  to: string;
  compare: boolean;
  label: string;
}

export const PRESETS: { key: Exclude<RangeKey, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '28d', label: 'Last 28 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: '12m', label: 'Last 12 months' },
];

export const DEFAULT_RANGE: RangeKey = '28d';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(s: unknown): s is string {
  return typeof s === 'string' && ISO_DAY.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function addMonths(iso: string, n: number): string {
  const d = toUtc(iso);
  d.setUTCMonth(d.getUTCMonth() + n);
  return fromUtc(d);
}

/** Inclusive day count: daysBetween('2026-01-01','2026-01-01') === 1. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000) + 1;
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: string): string {
  return addDays(startOfMonth(addMonths(startOfMonth(iso), 1)), -1);
}

/** Monday-start week label for a day. */
export function startOfWeek(iso: string): string {
  const d = toUtc(iso);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return fromUtc(d);
}

/** Today's calendar day in an IANA zone — the only place a clock is read. */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Every list of enumerated days between two dates, inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

function presetBounds(key: Exclude<RangeKey, 'custom'>, today: string): { from: string; to: string } {
  const yesterday = addDays(today, -1);
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday':
      return { from: yesterday, to: yesterday };
    case '7d':
      return { from: addDays(today, -7), to: yesterday };
    case '28d':
      return { from: addDays(today, -28), to: yesterday };
    case '90d':
      return { from: addDays(today, -90), to: yesterday };
    case 'month':
      return { from: startOfMonth(today), to: today };
    case 'last-month': {
      const lm = addMonths(startOfMonth(today), -1);
      return { from: lm, to: endOfMonth(lm) };
    }
    case '12m':
      return { from: addDays(addMonths(today, -12), 1), to: yesterday };
  }
}

export interface RangeParams {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  compare?: string | null;
}

/**
 * Turn URL search params into a concrete range for the given "today".
 * Unknown/invalid input falls back to the default preset rather than
 * throwing — a bad link should still render a dashboard.
 */
export function resolveRange(params: RangeParams, today: string): DateRange {
  const compare = params.compare === '1' || params.compare === 'true';
  if (isIsoDay(params.from) && isIsoDay(params.to)) {
    const from = params.from <= params.to ? params.from : params.to;
    const to = params.from <= params.to ? params.to : params.from;
    return { key: 'custom', from, to, compare, label: `${from} to ${to}` };
  }
  const key = (PRESETS.find((p) => p.key === params.range)?.key ?? DEFAULT_RANGE) as Exclude<RangeKey, 'custom'>;
  const { from, to } = presetBounds(key, today);
  return { key, from, to, compare, label: PRESETS.find((p) => p.key === key)!.label };
}

/** The same-length period immediately before the range (for comparisons). */
export function previousPeriod(range: { from: string; to: string }): { from: string; to: string } {
  const len = daysBetween(range.from, range.to);
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}

/** Query string that reproduces a range (keeps links shareable). */
export function rangeToQuery(range: DateRange): URLSearchParams {
  const q = new URLSearchParams();
  if (range.key === 'custom') {
    q.set('from', range.from);
    q.set('to', range.to);
  } else if (range.key !== DEFAULT_RANGE) {
    q.set('range', range.key);
  }
  if (range.compare) q.set('compare', '1');
  return q;
}

/** The natural time bucket for a range: daily under ~3 months, weekly to a year, else monthly. */
export function autoBucket(range: { from: string; to: string }): 'day' | 'week' | 'month' {
  const days = daysBetween(range.from, range.to);
  if (days <= 92) return 'day';
  if (days <= 400) return 'week';
  return 'month';
}
