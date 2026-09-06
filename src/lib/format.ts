/**
 * Deterministic formatting. Locale-dependent formatters (toLocaleString et
 * al) render differently in Node/workerd and the browser and cause hydration
 * mismatches in SSR'd client components — nothing here reads the
 * environment's locale or timezone.
 *
 * Dates in this app are calendar facts: a rollup `date` is a YYYY-MM-DD in
 * the property's reporting timezone and renders as written, never shifted.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function separate(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** '2026-09-05' → '05 Sep 2026'. Anything else echoes back. */
export function fmtDay(iso: string): string {
  if (!ISO_DAY.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

/** Short axis label: '5 Sep' (year dropped). */
export function fmtDayShort(iso: string): string {
  if (!ISO_DAY.test(iso)) return iso;
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

const HOUR_BUCKET = /^(\d{4}-\d{2}-\d{2})T(\d{2})$/;

/** '2026-09' → 'Sep 2026'; '2026-09-01' (a week/month bucket start) → '1 Sep'; '2026-09-06T14' → '14:00'. */
export function fmtBucket(label: string, bucket: 'hour' | 'day' | 'week' | 'month'): string {
  if (bucket === 'month' && /^\d{4}-\d{2}$/.test(label)) {
    const [y, m] = label.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }
  if (bucket === 'hour') {
    const m = HOUR_BUCKET.exec(label);
    return m ? `${m[2]}:00` : label;
  }
  return fmtDayShort(label);
}

/** An hour bucket with its day, for tooltips: '2026-09-06T14' → '6 Sep 14:00'. */
export function fmtHourLong(label: string): string {
  const m = HOUR_BUCKET.exec(label);
  return m ? `${fmtDayShort(m[1])} ${m[2]}:00` : label;
}

/** Day-of-week index (0 = Sunday, GA's convention) → 'Sun'. */
export function fmtDow(i: number): string {
  return DAYS[i] ?? String(i);
}

/** '14' → '14:00'. */
export function fmtHour(h: number | string): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/** An ISO-8601 instant → '05 Sep 2026 14:32' in UTC. Used for run timestamps
 *  in Settings, where an operator wants a stable clock, not a local one. */
export function fmtInstant(input: string | number | Date): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${hh}:${mm} UTC`;
}

/** Thousands-separated integer: 12,345. */
export function fmtInt(n: number): string {
  const r = Math.round(Math.abs(n));
  return `${n < 0 && r > 0 ? '−' : ''}${separate(r)}`;
}

/** Compact figure for tiles: 981 · 12.3k · 1.2m. */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 999_500) return `${sign}${(abs / 1_000_000).toFixed(abs >= 9_995_000 ? 0 : 1)}m`;
  if (abs >= 9_995) return `${sign}${Math.round(abs / 1_000)}k`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${separate(Math.round(abs))}`;
}

/** 0.4231 → '42.3%'. */
export function fmtPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return '–';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Seconds → '1m 12s' / '48s' / '2h 05m'. */
export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

/** 1.87 → '1.87'; keeps two decimals for ratios like views per session. */
export function fmtRatio(n: number): string {
  if (!Number.isFinite(n)) return '–';
  return n.toFixed(2);
}

/** Relative change as a signed percent: '+12.4%', '−3.1%', '0.0%'; null when
 *  the previous value was zero (there is no meaningful ratio). */
export function fmtDelta(current: number, previous: number): string | null {
  if (!previous) return null;
  const d = (current - previous) / previous;
  const sign = d > 0 ? '+' : d < 0 ? '−' : '';
  return `${sign}${(Math.abs(d) * 100).toFixed(1)}%`;
}

/** Title-case a slug/key for fallback labels. */
export function humanise(key: string): string {
  return key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
