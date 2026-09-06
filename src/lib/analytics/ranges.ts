/**
 * Date ranges — pure. Every date here is a calendar day 'YYYY-MM-DD' in the
 * property's reporting timezone, which is also how GA labels rollup rows.
 * Nothing reads the machine clock or zone except `todayInZone` / `hourInZone`,
 * which are given both explicitly.
 */

export type RangeKey =
  | 'today'
  | 'yesterday'
  | '7d'
  | '28d'
  | '90d'
  | 'month'
  | 'last-month'
  | 'ytd'
  | '12m'
  | 'all'
  | 'custom';

/** What a period is compared against: the same-length window before it, the
 *  same dates a year earlier, or any window of the reader's choosing. */
export type CompareMode = 'prev' | 'yoy' | 'custom';

export interface DateRange {
  key: RangeKey;
  from: string;
  to: string;
  /** null = no comparison on the page. */
  compare: CompareMode | null;
  /** The window compared against, when `compare` is set. */
  against: { from: string; to: string } | null;
  label: string;
}

export interface Preset {
  key: Exclude<RangeKey, 'custom'>;
  label: string;
  /** The keyboard shortcut (a single letter; pressed outside any field). */
  shortcut: string;
}

export const PRESETS: Preset[] = [
  { key: 'today', label: 'Today', shortcut: 'D' },
  { key: 'yesterday', label: 'Yesterday', shortcut: 'E' },
  { key: '7d', label: 'Last 7 days', shortcut: 'W' },
  { key: '28d', label: 'Last 28 days', shortcut: 'T' },
  { key: '90d', label: 'Last 90 days', shortcut: 'Q' },
  { key: 'month', label: 'This month', shortcut: 'M' },
  { key: 'last-month', label: 'Last month', shortcut: 'P' },
  { key: 'ytd', label: 'Year to date', shortcut: 'Y' },
  { key: '12m', label: 'Last 12 months', shortcut: 'L' },
  { key: 'all', label: 'All time', shortcut: 'A' },
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

export function startOfYear(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
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

/** The current hour (0–23) in an IANA zone, so an hourly chart of today stops at now. */
export function hourInZone(timeZone: string, now: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    return Number(parts.find((p) => p.type === 'hour')?.value ?? now.getUTCHours()) % 24;
  } catch {
    return now.getUTCHours();
  }
}

/** Every list of enumerated days between two dates, inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Hour bucket names 'YYYY-MM-DDTHH' for a span; `lastHour` caps the final day (today, up to now). */
export function eachHour(from: string, to: string, lastHour = 23): string[] {
  const out: string[] = [];
  for (const d of eachDay(from, to)) {
    const cap = d === to ? lastHour : 23;
    for (let h = 0; h <= cap; h++) out.push(`${d}T${String(h).padStart(2, '0')}`);
  }
  return out;
}

export interface RangeOptions {
  /** The first day the site holds, for "All time"; null falls back to the last 12 months. */
  earliest?: string | null;
}

function presetBounds(key: Exclude<RangeKey, 'custom'>, today: string, opts: RangeOptions = {}): { from: string; to: string } {
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
    case 'ytd':
      return { from: startOfYear(today), to: today };
    case '12m':
      return { from: addDays(addMonths(today, -12), 1), to: yesterday };
    case 'all': {
      const from = isIsoDay(opts.earliest) && opts.earliest <= today ? opts.earliest : addDays(addMonths(today, -12), 1);
      return { from, to: today };
    }
  }
}

export interface RangeParams {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  /** 'prev' (or the legacy '1'), 'yoy', or a custom window 'YYYY-MM-DD..YYYY-MM-DD'. */
  compare?: string | null;
  /** The dashboard-wide filter, 'kind:op:value' (see segments.ts). */
  seg?: string | null;
}

const CUSTOM_COMPARE = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

/** The compare mode a URL value names, or null. */
export function parseCompare(raw: string | null | undefined, range: { from: string; to: string }): { compare: CompareMode | null; against: { from: string; to: string } | null } {
  if (!raw) return { compare: null, against: null };
  if (raw === '1' || raw === 'true' || raw === 'prev') return { compare: 'prev', against: previousPeriod(range) };
  if (raw === 'yoy') return { compare: 'yoy', against: yearBefore(range) };
  const m = CUSTOM_COMPARE.exec(raw);
  if (m && isIsoDay(m[1]) && isIsoDay(m[2])) {
    const from = m[1] <= m[2] ? m[1] : m[2];
    const to = m[1] <= m[2] ? m[2] : m[1];
    return { compare: 'custom', against: { from, to } };
  }
  return { compare: null, against: null };
}

/**
 * Turn URL search params into a concrete range for the given "today".
 * Unknown/invalid input falls back to the default preset rather than
 * throwing — a bad link should still render a dashboard.
 */
export function resolveRange(params: RangeParams, today: string, opts: RangeOptions = {}): DateRange {
  if (isIsoDay(params.from) && isIsoDay(params.to)) {
    const from = params.from <= params.to ? params.from : params.to;
    const to = params.from <= params.to ? params.to : params.from;
    return { key: 'custom', from, to, ...parseCompare(params.compare, { from, to }), label: `${from} to ${to}` };
  }
  const preset = PRESETS.find((p) => p.key === params.range) ?? PRESETS.find((p) => p.key === DEFAULT_RANGE)!;
  const { from, to } = presetBounds(preset.key, today, opts);
  return { key: preset.key, from, to, ...parseCompare(params.compare, { from, to }), label: preset.label };
}

/** The same-length period immediately before the range. */
export function previousPeriod(range: { from: string; to: string }): { from: string; to: string } {
  const len = daysBetween(range.from, range.to);
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}

/** The same dates one year earlier. */
export function yearBefore(range: { from: string; to: string }): { from: string; to: string } {
  return { from: addMonths(range.from, -12), to: addMonths(range.to, -12) };
}

/** The window a widget compares against: the page's choice, else the period before. */
export function comparisonPeriod(range: DateRange): { from: string; to: string } {
  return range.against ?? previousPeriod(range);
}

/** How the comparison reads in a lede: "…compared with the period before". */
export function compareNoun(range: DateRange, fmt: (iso: string) => string = (s) => s): string | null {
  if (!range.compare || !range.against) return null;
  if (range.compare === 'prev') return 'the period before';
  if (range.compare === 'yoy') return 'the same period last year';
  return `${fmt(range.against.from)} to ${fmt(range.against.to)}`;
}

/** The short caption under a delta: 'vs prev', 'vs last year', 'vs period'. */
export function compareCaption(mode: CompareMode | null | undefined): string {
  return mode === 'yoy' ? 'vs last year' : mode === 'custom' ? 'vs period' : 'vs prev';
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
  if (range.compare === 'custom' && range.against) q.set('compare', `${range.against.from}..${range.against.to}`);
  else if (range.compare) q.set('compare', range.compare);
  return q;
}

/** The natural time bucket for a range: daily under ~3 months, weekly to a year, else monthly. */
export function autoBucket(range: { from: string; to: string }): 'day' | 'week' | 'month' {
  const days = daysBetween(range.from, range.to);
  if (days <= 92) return 'day';
  if (days <= 400) return 'week';
  return 'month';
}

/** Ranges short enough to chart by the hour (today, yesterday, any two days). */
export function isHourly(range: { from: string; to: string }): boolean {
  return daysBetween(range.from, range.to) <= 2;
}

/**
 * The days a chart bucket covers, clamped to the period it was drawn in, so a
 * click on a day, week or month mark can narrow the page to exactly that span.
 * Returns null for labels that are not calendar buckets (hours, realtime minutes).
 */
export function bucketSpan(name: string, bucket: 'hour' | 'day' | 'week' | 'month' | 'minute', within: { from: string; to: string }): { from: string; to: string } | null {
  let from: string;
  let to: string;
  if (bucket === 'day' && isIsoDay(name)) {
    from = name;
    to = name;
  } else if (bucket === 'week' && isIsoDay(name)) {
    from = name;
    to = addDays(name, 6);
  } else if (bucket === 'month' && /^\d{4}-\d{2}$/.test(name)) {
    from = `${name}-01`;
    to = endOfMonth(from);
  } else {
    return null;
  }
  if (from < within.from) from = within.from;
  if (to > within.to) to = within.to;
  return from <= to ? { from, to } : null;
}
