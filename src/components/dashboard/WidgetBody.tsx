'use client';

import type { CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { DATASET_BY_KEY, drillValue, type Dataset } from '@/lib/analytics/catalog';
import { entityHref, type EntityKind } from '@/lib/analytics/entities';
import { METRIC_BY_KEY, isMetricKey, type MetricDef } from '@/lib/analytics/metrics';
import { fmtBucket, fmtDelta, fmtInt, fmtPercent } from '@/lib/format';
import type { WidgetConfig, WidgetData, WidgetInstance } from '@/lib/dashboard/types';

// Theme-aware series slots (the direction reverses per theme in globals.css).
const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];
const axisTick = { fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--muted)' };
const TOOLTIP = { fontSize: 12, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--fg)', fontFamily: 'var(--font-mono)' };

function metricFor(config: WidgetConfig): MetricDef {
  const ds = config.dataset ? DATASET_BY_KEY[config.dataset] : undefined;
  const key = isMetricKey(config.metric) && ds?.metrics.includes(config.metric) ? config.metric : ds?.defaultMetric ?? 'users';
  return METRIC_BY_KEY[key];
}

/* ── Drill-down links ────────────────────────────────────────────── */
const PERIOD_KEYS = ['range', 'from', 'to', 'compare'];

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

/** Where a ranked row opens, or null when the dataset does not drill. */
export function useDrill(ds: Dataset | undefined): ((row: { key: string; sub?: string }) => string | null) | null {
  const query = usePeriodQuery();
  if (!ds?.drill) return null;
  const kind: EntityKind = ds.drill;
  return (row) => (row.key === '(other)' ? null : entityHref(kind, drillValue(ds, row), query));
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <div className="wbody center">{children}</div>;
}

function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/* ── KPI ─────────────────────────────────────────────────────────── */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 100;
  const h = 30;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / span) * (h - 2) - 1] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${d} L${w},${h} L0,${h} Z`;
  return (
    <div className="kspark" aria-hidden>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path d={area} fill="var(--series-1)" opacity={0.12} />
        <path d={d} fill="none" stroke="var(--series-1)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function KpiBody({ value, previous, spark, metric, live }: { value: number; previous: number | null; spark: number[]; metric: MetricDef; live: boolean }) {
  const delta = previous !== null ? fmtDelta(value, previous) : null;
  const dir = previous === null || previous === value ? 'flat' : value > previous ? 'up' : 'down';
  const good = metric.goodDirection === null ? 'flat' : dir === 'flat' ? 'flat' : (dir === 'up') === (metric.goodDirection === 'up') ? 'up' : 'down';
  return (
    <div className="kpi">
      <div className="kv">{metric.format(value, true)}</div>
      <div className="kf">
        {live ? (
          <span className="live">
            <span className="rag g" /> live
          </span>
        ) : delta !== null ? (
          <span className={`delta ${good}`}>
            {delta}
            <small>vs prev</small>
          </span>
        ) : previous !== null ? (
          <span className="delta">— vs prev</span>
        ) : null}
      </div>
      <Sparkline values={spark} />
    </div>
  );
}

/* ── Ranked list ─────────────────────────────────────────────────── */
export function ListBody({
  rows,
  metric,
  dimLabel,
  showAs,
  href,
  mono,
}: {
  rows: { key: string; sub?: string; value: number; share: number }[];
  metric: MetricDef;
  dimLabel: string;
  showAs?: 'value' | 'percent';
  /** Where a row opens (drill-down); rows returning null stay plain. */
  href?: ((row: { key: string; sub?: string }) => string | null) | null;
  mono?: boolean;
}) {
  if (rows.length === 0) return <Centered>No data for this period</Centered>;
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  return (
    <div className="rank">
      <div className="rh">
        <span>{dimLabel}</span>
        <span>{metric.short}</span>
      </div>
      {rows.map((r, i) => {
        const to = href ? href(r) : null;
        const style = { '--w': `${Math.max(0, (r.value / max) * 100)}%` } as CSSProperties;
        const title = r.sub ? `${r.key} · ${r.sub}` : r.key;
        const inner = (
          <>
            <span className={mono ? 'rl mono' : 'rl'}>
              {r.key}
              {r.sub ? <small>{r.sub}</small> : null}
            </span>
            <span className="rval">
              {showAs === 'percent' && metric.kind === 'sum' ? fmtPercent(r.share) : metric.format(r.value)}
              {showAs !== 'percent' && r.share > 0 && metric.kind === 'sum' ? <i>{fmtPercent(r.share, 0)}</i> : null}
            </span>
          </>
        );
        return to ? (
          <a key={`${r.key}-${i}`} className="rr link" style={style} title={`${title} · open`} href={to}>
            {inner}
          </a>
        ) : (
          <div key={`${r.key}-${i}`} className="rr" style={style} title={title}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/* ── Charts ──────────────────────────────────────────────────────── */
function DonutBody({ rows, total, metric, href }: { rows: { key: string; sub?: string; value: number }[]; total: number; metric: MetricDef; href?: ((row: { key: string; sub?: string }) => string | null) | null }) {
  const router = useRouter();
  if (rows.length === 0) return <Centered>No data for this period</Centered>;
  const shown = rows.reduce((a, r) => a + r.value, 0);
  const data = [...rows.map((r) => ({ name: r.key, value: r.value, to: href ? href(r) : null }))];
  if (metric.kind === 'sum' && total > shown + 0.5) data.push({ name: 'Other', value: total - shown, to: null });
  const open = (d: { to?: string | null }) => {
    if (d?.to) router.push(d.to);
  };
  return (
    <ChartFrame>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={1} stroke="var(--bg)" startAngle={90} endAngle={-270} isAnimationActive={false} onClick={(_, i) => open(data[i])} style={href ? { cursor: 'pointer' } : undefined}>
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP} formatter={(v) => metric.format(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} />
      </PieChart>
    </ChartFrame>
  );
}

function ColumnBody({ data, metric, bucket }: { data: { name: string; value: number; previous?: number }[]; metric: MetricDef; bucket?: string }) {
  if (data.length === 0) return <Centered>No data for this period</Centered>;
  const fmtX = (v: string) => (bucket && bucket !== 'minute' ? fmtBucket(v, bucket as 'day' | 'week' | 'month') : bucket === 'minute' ? `${v}m` : v);
  const compare = data.some((d) => d.previous !== undefined);
  return (
    <ChartFrame>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line)' }} tickFormatter={fmtX} interval="preserveStartEnd" minTickGap={18} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => metric.format(Number(v), true)} />
        <Tooltip cursor={{ fill: 'var(--ghost)' }} contentStyle={TOOLTIP} labelFormatter={(l) => fmtX(String(l))} formatter={(v, name) => [metric.format(Number(v)), name === 'previous' ? 'Previous' : metric.short]} />
        {compare ? <Bar dataKey="previous" fill={SERIES[2]} opacity={0.45} isAnimationActive={false} /> : null}
        <Bar dataKey="value" fill={SERIES[0]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartFrame>
  );
}

function BarBody({ rows, metric, href }: { rows: { key: string; sub?: string; value: number }[]; metric: MetricDef; href?: ((row: { key: string; sub?: string }) => string | null) | null }) {
  const router = useRouter();
  if (rows.length === 0) return <Centered>No data for this period</Centered>;
  const data = rows.map((r) => ({ name: r.key, value: r.value, to: href ? href(r) : null }));
  const open = (d: { to?: string | null }) => {
    if (d?.to) router.push(d.to);
  };
  return (
    <ChartFrame>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke="var(--line)" />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => metric.format(Number(v), true)} />
        <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 11 }} tickLine={false} axisLine={false} width={120} />
        <Tooltip cursor={{ fill: 'var(--ghost)' }} contentStyle={TOOLTIP} formatter={(v) => [metric.format(Number(v)), metric.short]} />
        <Bar dataKey="value" fill={SERIES[0]} radius={[0, 3, 3, 0]} isAnimationActive={false} onClick={(_, i) => open(data[i])} style={href ? { cursor: 'pointer' } : undefined} />
      </BarChart>
    </ChartFrame>
  );
}

function LineBody({ points, metric, bucket }: { points: { name: string; value: number; previous?: number }[]; metric: MetricDef; bucket: string }) {
  if (points.length === 0) return <Centered>No data for this period</Centered>;
  const compare = points.some((p) => p.previous !== undefined);
  const fmtX = (v: string) => (bucket === 'minute' ? `${v}m` : fmtBucket(v, bucket as 'day' | 'week' | 'month'));
  return (
    <ChartFrame>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line)' }} tickFormatter={fmtX} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => metric.format(Number(v), true)} />
        <Tooltip contentStyle={TOOLTIP} labelFormatter={(l) => fmtX(String(l))} formatter={(v, name) => [metric.format(Number(v)), name === 'previous' ? 'Previous period' : metric.label]} />
        {compare ? <Line type="monotone" dataKey="previous" stroke={SERIES[2]} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} /> : null}
        <Line type="monotone" dataKey="value" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
      </LineChart>
    </ChartFrame>
  );
}

/* ── Table ───────────────────────────────────────────────────────── */
function TableBody({ columns, rows, href }: { columns: { key: string; label: string; metric: boolean }[]; rows: Record<string, string | number>[]; href?: ((row: { key: string; sub?: string }) => string | null) | null }) {
  if (rows.length === 0) return <Centered>No data for this period</Centered>;
  const cols: Column<Record<string, string | number>>[] = columns.map((c) => ({
    key: c.key,
    header: c.label,
    align: c.metric ? 'right' : 'left',
    mono: c.metric,
    cell: (r) => {
      if (!c.metric) {
        const to = href ? href({ key: String(r.name), sub: r.sub === undefined ? undefined : String(r.sub) }) : null;
        const label = (
          <>
            {String(r[c.key])}
            {r.sub ? <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 11 }}>{String(r.sub)}</span> : null}
          </>
        );
        const clip: CSSProperties = { display: 'inline-block', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' };
        return to ? (
          <a className="dlink" href={to} title={`${String(r.name)} · open`} style={clip}>
            {label}
          </a>
        ) : (
          <span title={String(r.name)} style={clip}>
            {label}
          </span>
        );
      }
      const m = isMetricKey(c.key) ? METRIC_BY_KEY[c.key] : null;
      return m ? m.format(Number(r[c.key])) : fmtInt(Number(r[c.key]));
    },
    sortValue: (r) => (c.metric ? Number(r[c.key]) : String(r[c.key])),
    cellStyle: c.metric ? { color: 'var(--fg)', fontVariantNumeric: 'tabular-nums' } : { fontWeight: 400 },
  }));
  return <DataTable columns={cols} rows={rows} getRowKey={(_, i) => i} empty="No rows" />;
}

/* ── Note ────────────────────────────────────────────────────────── */
function NoteBody({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return <Centered>Empty note — edit to add text.</Centered>;
  return (
    <div className="docs-prose wnote" style={{ fontSize: 13.5 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

/* ── Dispatch ────────────────────────────────────────────────────── */
export function WidgetBody({ instance, data }: { instance: WidgetInstance; data: WidgetData | null }) {
  const metric = metricFor(instance.config);
  const ds = instance.config.dataset ? DATASET_BY_KEY[instance.config.dataset] : undefined;
  const href = useDrill(ds);
  if (instance.type === 'note') return <NoteBody markdown={instance.config.markdown ?? ''} />;
  if (!data) return null;
  switch (data.kind) {
    case 'kpi':
      return <KpiBody value={data.value} previous={data.previous} spark={data.spark} metric={metric} live={!!ds?.live} />;
    case 'timeseries':
      return instance.type === 'column' ? <ColumnBody data={data.points} metric={metric} bucket={data.bucket} /> : <LineBody points={data.points} metric={metric} bucket={data.bucket} />;
    case 'ranked':
      if (instance.type === 'donut') return <DonutBody rows={data.rows} total={data.total} metric={metric} href={href} />;
      if (instance.type === 'bar') return <BarBody rows={data.rows} metric={metric} href={href} />;
      if (instance.type === 'column' || instance.type === 'line') return <ColumnBody data={data.rows.map((r) => ({ name: r.key, value: r.value }))} metric={metric} />;
      return <ListBody rows={data.rows} metric={metric} dimLabel={ds?.dimLabel ?? ''} showAs={instance.config.showAs} href={href} />;
    case 'table':
      return <TableBody columns={data.columns} rows={data.rows} href={href} />;
    case 'empty':
      return <Centered>{data.reason ?? 'Nothing to show'}</Centered>;
    default:
      return <Centered>Not configured yet</Centered>;
  }
}
