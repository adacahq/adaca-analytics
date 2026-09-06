'use client';

/**
 * What every chart shares: series colours, axis styling, the tooltip with its
 * "click to…" hint, clickable axis ticks, and the hooks that turn a click on a
 * mark into a navigation — to an entity page, or to the same page narrowed to
 * the clicked day, week or month.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Text } from 'recharts';
import type { Bucket } from '@/lib/dashboard/types';
import { bucketSpan } from '@/lib/analytics/ranges';

// Theme-aware series slots (the direction reverses per theme in globals.css).
export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];
export const axisTick = { fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--muted)' };

const PERIOD_KEYS = ['range', 'from', 'to', 'compare'];

/** True on phone-width viewports (≤640px), so charts can trade label room for plot room. */
export function useCompact(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return compact;
}

/** The period query to carry onto an entity page, from the current URL. */
export function usePeriodQuery(): string {
  const params = useSearchParams();
  const q = new URLSearchParams();
  for (const k of PERIOD_KEYS) {
    const v = params?.get(k);
    if (v) q.set(k, v);
  }
  return q.toString();
}

/** Human name of a bucket, for hints. */
export function bucketNoun(bucket: Bucket | 'minute'): string {
  return bucket === 'week' ? 'week' : bucket === 'month' ? 'month' : 'day';
}

/**
 * A function that narrows the current page's period to one chart bucket, or
 * null when the series has no calendar span (realtime minutes). Keeps every
 * other URL param, including compare mode.
 */
export function useNarrow(bucket: Bucket | 'minute', from?: string, to?: string): ((name: string) => void) | null {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  if (!from || !to || bucket === 'minute') return null;
  return (name: string) => {
    const span = bucketSpan(name, bucket, { from, to });
    if (!span || (span.from === from && span.to === to)) return;
    const q = new URLSearchParams(params?.toString());
    q.delete('range');
    q.set('from', span.from);
    q.set('to', span.to);
    router.push(`${path}?${q.toString()}`);
  };
}

/** The bucket name a chart-level click landed on (recharts hands the active label). */
export function clickedName(state: unknown): string | null {
  const s = state as { activeLabel?: unknown } | null;
  return s && s.activeLabel !== undefined && s.activeLabel !== null ? String(s.activeLabel) : null;
}

/* ── Tooltip ─────────────────────────────────────────────────────── */
export interface TipProps {
  active?: boolean;
  payload?: { dataKey?: string | number; name?: string | number; value?: unknown; payload?: unknown }[];
  label?: unknown;
  /** Format the x label. */
  title?: (label: string) => string;
  /** Format a value and name its series. */
  row: (value: number, dataKey: string) => [string, string];
  /** The click affordance under the values: fixed text, or decided per mark (the hovered data entry). */
  hint?: string | null | ((mark: unknown) => string | null);
}

/** The one tooltip: label, one line per series, and the click hint. */
export function ChartTip({ active, payload, label, title, row, hint }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0];
  const hasLabel = label !== undefined && label !== null && label !== '';
  const heading = hasLabel ? (title ? title(String(label)) : String(label)) : String(first.name ?? '');
  const text = typeof hint === 'function' ? hint(first.payload) : hint;
  return (
    <div className="ctip">
      {heading ? <b>{heading}</b> : null}
      {payload.map((p, i) => {
        const [v, name] = row(Number(p.value), String(p.dataKey ?? p.name ?? ''));
        return (
          <span key={i}>
            {name}: {v}
          </span>
        );
      })}
      {text ? <small>{text}</small> : null}
    </div>
  );
}

/* ── Clickable axis ticks ────────────────────────────────────────── */
export interface TickProps {
  x?: number | string;
  y?: number | string;
  payload?: { value?: unknown };
  textAnchor?: string;
  verticalAnchor?: string;
  width?: number | string;
  /** Font size; the theme's axis size by default. */
  size?: number;
  /** Label text for a raw tick value. */
  format?: (value: string) => string;
  /** Where the tick opens; null keeps it plain text. */
  onOpen?: ((value: string) => void) | null;
  /** Whatever else recharts hands a custom tick (angle, index, fill…); ignored. */
  [extra: string]: unknown;
}

type Anchor = 'start' | 'middle' | 'end' | 'inherit';
type VAnchor = 'start' | 'middle' | 'end';

/**
 * An axis label that is a link when its mark is one. Recharts hands custom
 * ticks its own fill and size, which are ignored here so the theme's axis
 * styling wins in both light and dark.
 */
export function LinkTick({ x, y, payload, textAnchor, verticalAnchor, width, size, format, onOpen }: TickProps) {
  const raw = payload?.value === undefined || payload.value === null ? '' : String(payload.value);
  const label = format ? format(raw) : raw;
  const common = {
    x: Number(x ?? 0),
    y: Number(y ?? 0),
    textAnchor: (textAnchor ?? 'middle') as Anchor,
    verticalAnchor: (verticalAnchor ?? 'start') as VAnchor,
    width: typeof width === 'number' ? width : undefined,
    fill: axisTick.fill,
    fontSize: size ?? axisTick.fontSize,
    fontFamily: axisTick.fontFamily,
  };
  if (!onOpen) return <Text {...common}>{label}</Text>;
  return (
    <Text {...common} className="tick-link" onClick={() => onOpen(raw)}>
      {label}
    </Text>
  );
}

/** The chart's box; `clickable` swaps the cursor over the plot and legend. */
export function ChartFrame({ children, clickable, height = '100%' }: { children: ReactNode; clickable?: boolean; height?: number | string }) {
  return (
    <div className={clickable ? 'chart-box chart-click' : 'chart-box'} style={{ width: '100%', height, minHeight: 120 }}>
      {children}
    </div>
  );
}
