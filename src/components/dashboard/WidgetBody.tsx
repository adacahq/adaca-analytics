'use client';

import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { DATASET_BY_KEY, drillValue, kpiDrill, type Dataset } from '@/lib/analytics/catalog';
import { entityHref } from '@/lib/analytics/entities';
import { METRIC_BY_KEY, isMetricKey, type MetricDef } from '@/lib/analytics/metrics';
import { fmtBucket, fmtDelta, fmtHourLong, fmtInt, fmtPercent } from '@/lib/format';
import type { Bucket, RankedRow, WidgetConfig, WidgetData, WidgetInstance } from '@/lib/dashboard/types';
import { ChartFrame, ChartTip, LinkTick, SERIES, axisTick, clickedName, useCompact, useCompareCaption, useHints, useNarrow, usePeriodQuery, useTapToOpen } from './chart-helpers';
import { useShare } from './ShareContext';

/** Where a ranked row opens; null keeps the mark plain. */
export type Href = ((row: { key: string; sub?: string; raw?: string }) => string | null) | null;

function metricFor(config: WidgetConfig): MetricDef {
  const ds = config.dataset ? DATASET_BY_KEY[config.dataset] : undefined;
  const key = isMetricKey(config.metric) && ds?.metrics.includes(config.metric) ? config.metric : ds?.defaultMetric ?? 'users';
  return METRIC_BY_KEY[key];
}

/** The drill link for rows of a dataset, from the current URL's period (none on a shared dashboard). */
export function useDrill(ds: Dataset | undefined): Href {
  const query = usePeriodQuery();
  const share = useShare();
  if (!ds?.drill || share) return null;
  const kind = ds.drill;
  return (row) => ((row.raw ?? row.key) === '(other)' ? null : entityHref(kind, drillValue(ds, row), query));
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <div className="wbody center">{children}</div>;
}

const OPEN_HINT = 'Click to open';

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

function KpiBody({ value, previous, spark, metric, live, href }: { value: number; previous: number | null; spark: number[]; metric: MetricDef; live: boolean; href?: string | null }) {
  const caption = useCompareCaption();
  const delta = previous !== null ? fmtDelta(value, previous) : null;
  const dir = previous === null || previous === value ? 'flat' : value > previous ? 'up' : 'down';
  const good = metric.goodDirection === null ? 'flat' : dir === 'flat' ? 'flat' : (dir === 'up') === (metric.goodDirection === 'up') ? 'up' : 'down';
  const inner = (
    <>
      <div className="kv">{metric.format(value, true)}</div>
      <div className="kf">
        {live ? (
          <span className="live">
            <span className="rag g" /> live
          </span>
        ) : delta !== null ? (
          <span className={`delta ${good}`}>
            {delta}
            <small>{caption}</small>
          </span>
        ) : previous !== null ? (
          <span className="delta">— {caption}</span>
        ) : null}
        {href ? <span className="kopen">open ↗</span> : null}
      </div>
      <Sparkline values={spark} />
    </>
  );
  return href ? (
    <a className="kpi link" href={href} title={OPEN_HINT}>
      {inner}
    </a>
  ) : (
    <div className="kpi">{inner}</div>
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
  rows: RankedRow[];
  metric: MetricDef;
  dimLabel: string;
  showAs?: 'value' | 'percent';
  href?: Href;
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
          <a key={`${r.key}-${i}`} className="rr link" style={style} title={`${title} · ${OPEN_HINT.toLowerCase()}`} href={to}>
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
interface Mark {
  name: string;
  value: number;
  previous?: number;
  /** Entity page the mark opens, when it is one. */
  to?: string | null;
}

const withLinks = (rows: RankedRow[], href: Href): Mark[] => rows.map((r) => ({ name: r.key, value: r.value, to: href ? href(r) : null }));

/** Donut of shares; sectors and legend entries open their entity. */
function DonutBody({ rows, total, metric, href }: { rows: RankedRow[]; total: number; metric: MetricDef; href?: Href }) {
  const router = useRouter();
  const arm = useTapToOpen();
  const hints = useHints();
  if (rows.length === 0) return <Centered>No data for this period</Centered>;
  const shown = rows.reduce((a, r) => a + r.value, 0);
  const data: Mark[] = withLinks(rows, href ?? null);
  if (metric.kind === 'sum' && total > shown + 0.5) data.push({ name: 'Other', value: total - shown, to: null });
  const clickable = data.some((d) => d.to);
  const open = (i: number) => {
    const d = data[i];
    if (d?.to) router.push(d.to);
  };
  return (
    <ChartFrame clickable={clickable}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={1} stroke="var(--bg)" startAngle={90} endAngle={-270} isAnimationActive={false} onClick={(_, i) => arm(`sector:${i}`) && open(i)}>
            {data.map((d, i) => (
              <Cell key={i} fill={SERIES[i % SERIES.length]} style={{ cursor: d.to ? 'pointer' : 'default', outline: 'none' }} />
            ))}
          </Pie>
          <Tooltip content={<ChartTip row={(v) => [metric.format(v), metric.short]} hint={(p) => ((p as Mark | undefined)?.to ? hints.open : null)} />} />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} onClick={(e) => open(data.findIndex((d) => d.name === e.value))} />
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/**
 * Vertical columns. Two modes: ranked categories (a click opens the entity)
 * or calendar buckets (a click narrows the period to that bucket).
 */
function ColumnBody({ data, metric, bucket, narrow }: { data: Mark[]; metric: MetricDef; bucket?: Bucket | 'minute'; narrow?: ((name: string) => void) | null }) {
  const router = useRouter();
  const arm = useTapToOpen();
  const hints = useHints();
  if (data.length === 0) return <Centered>No data for this period</Centered>;
  const fmtX = (v: string) => (bucket && bucket !== 'minute' ? fmtBucket(v, bucket) : bucket === 'minute' ? `${v}m` : v);
  const fmtTitle = (v: string) => (bucket === 'hour' ? fmtHourLong(v) : fmtX(v));
  const compare = data.some((d) => d.previous !== undefined);
  const byName = new Map(data.map((d) => [d.name, d]));
  const openName = narrow ? narrow : (name: string) => {
    const d = byName.get(name);
    if (d?.to) router.push(d.to);
  };
  const clickable = !!narrow || data.some((d) => d.to);
  const hint = narrow ? hints.narrow(bucket ?? 'day') : clickable ? (p: unknown) => ((p as Mark | undefined)?.to ? hints.open : null) : null;
  return (
    <ChartFrame clickable={clickable}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
          onClick={(state) => {
            const name = clickedName(state);
            if (name !== null && clickable && arm(name)) openName(name);
          }}
        >
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="name" tick={(p) => <LinkTick {...p} format={fmtX} onOpen={clickable ? openName : null} />} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => metric.format(Number(v), true)} />
          <Tooltip cursor={{ fill: 'var(--ghost)' }} content={<ChartTip title={fmtTitle} row={(v, k) => [metric.format(v), k === 'previous' ? 'Compared' : metric.short]} hint={hint} />} />
          {compare ? <Bar dataKey="previous" fill={SERIES[2]} opacity={0.45} isAnimationActive={false} /> : null}
          <Bar dataKey="value" fill={SERIES[0]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Horizontal bars, longest first; a bar, its band and its label open the entity. */
function BarBody({ rows, metric, href }: { rows: RankedRow[]; metric: MetricDef; href?: Href }) {
  const router = useRouter();
  const compact = useCompact();
  const arm = useTapToOpen();
  const hints = useHints();
  if (rows.length === 0) return <Centered>No data for this period</Centered>;
  const data = withLinks(rows, href ?? null);
  const byName = new Map(data.map((d) => [d.name, d]));
  const clickable = data.some((d) => d.to);
  const openName = (name: string) => {
    const d = byName.get(name);
    if (d?.to) router.push(d.to);
  };
  return (
    <ChartFrame clickable={clickable}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, bottom: 0, left: compact ? 0 : 8 }}
          barCategoryGap={6}
          onClick={(state) => {
            const name = clickedName(state);
            if (name !== null && arm(name)) openName(name);
          }}
        >
          <CartesianGrid horizontal={false} stroke="var(--line)" />
          <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => metric.format(Number(v), true)} />
          <YAxis type="category" dataKey="name" tick={(p) => <LinkTick {...p} size={compact ? 10 : 11} onOpen={clickable ? openName : null} />} tickLine={false} axisLine={false} width={compact ? 88 : 120} />
          <Tooltip cursor={{ fill: 'var(--ghost)' }} content={<ChartTip row={(v) => [metric.format(v), metric.short]} hint={clickable ? (p) => ((p as Mark | undefined)?.to ? hints.open : null) : null} />} />
          <Bar dataKey="value" fill={SERIES[0]} radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} style={{ cursor: d.to ? 'pointer' : 'default' }} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** A metric over calendar buckets; a click anywhere on the plot narrows the period to that bucket. */
function LineBody({ points, metric, bucket, narrow }: { points: Mark[]; metric: MetricDef; bucket: Bucket | 'minute'; narrow?: ((name: string) => void) | null }) {
  const arm = useTapToOpen();
  const hints = useHints();
  if (points.length === 0) return <Centered>No data for this period</Centered>;
  const compare = points.some((p) => p.previous !== undefined);
  const fmtX = (v: string) => (bucket === 'minute' ? `${v}m` : fmtBucket(v, bucket));
  const fmtTitle = (v: string) => (bucket === 'hour' ? fmtHourLong(v) : fmtX(v));
  return (
    <ChartFrame clickable={!!narrow}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
          onClick={(state) => {
            const name = clickedName(state);
            if (name !== null && narrow && arm(name)) narrow(name);
          }}
        >
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="name" tick={(p) => <LinkTick {...p} format={fmtX} onOpen={narrow ?? null} />} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => metric.format(Number(v), true)} />
          <Tooltip content={<ChartTip title={fmtTitle} row={(v, k) => [metric.format(v), k === 'previous' ? 'Compared period' : metric.label]} hint={narrow ? hints.narrow(bucket) : null} />} />
          {compare ? <Line type="monotone" dataKey="previous" stroke={SERIES[2]} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} /> : null}
          <Line type="monotone" dataKey="value" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ── Table ───────────────────────────────────────────────────────── */
export function TableBody({ columns, rows, href }: { columns: { key: string; label: string; metric: boolean }[]; rows: Record<string, string | number>[]; href?: Href }) {
  if (rows.length === 0) return <Centered>No data for this period</Centered>;
  const cols: Column<Record<string, string | number>>[] = columns.map((c) => ({
    key: c.key,
    header: c.label,
    align: c.metric ? 'right' : 'left',
    mono: c.metric,
    cell: (r) => {
      if (!c.metric) {
        const to = href ? href({ key: String(r.name), raw: r.raw === undefined ? undefined : String(r.raw), sub: r.sub === undefined ? undefined : String(r.sub) }) : null;
        const label = (
          <>
            {String(r[c.key])}
            {r.sub ? <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 11 }}>{String(r.sub)}</span> : null}
          </>
        );
        const clip: CSSProperties = { display: 'inline-block', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' };
        return to ? (
          <a className="dlink" href={to} title={`${String(r.name)} · ${OPEN_HINT.toLowerCase()}`} style={clip}>
            {label}
          </a>
        ) : (
          <span title={String(r.name)} style={clip}>
            {label}
          </span>
        );
      }
      if (c.key === 'share') return fmtPercent(Number(r.share));
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
  const query = usePeriodQuery();
  const share = useShare();
  const ts = data?.kind === 'timeseries' ? data : null;
  const narrow = useNarrow(ts?.bucket ?? 'minute', ts?.from, ts?.to);
  if (instance.type === 'note') return <NoteBody markdown={instance.config.markdown ?? ''} />;
  if (!data) return null;
  const target = ds && !share ? kpiDrill(ds, instance.config.filters) : null;
  const kpiHref = target ? entityHref(target.kind, target.value, query) : null;
  switch (data.kind) {
    case 'kpi':
      return <KpiBody value={data.value} previous={data.previous} spark={data.spark} metric={metric} live={!!ds?.live} href={kpiHref} />;
    case 'timeseries':
      return instance.type === 'column' ? (
        <ColumnBody data={data.points} metric={metric} bucket={data.bucket} narrow={narrow} />
      ) : (
        <LineBody points={data.points} metric={metric} bucket={data.bucket} narrow={narrow} />
      );
    case 'ranked':
      if (instance.type === 'donut') return <DonutBody rows={data.rows} total={data.total} metric={metric} href={href} />;
      if (instance.type === 'bar') return <BarBody rows={data.rows} metric={metric} href={href} />;
      if (instance.type === 'column' || instance.type === 'line') return <ColumnBody data={withLinks(data.rows, href)} metric={metric} />;
      return <ListBody rows={data.rows} metric={metric} dimLabel={ds?.dimLabel ?? ''} showAs={instance.config.showAs} href={href} />;
    case 'table':
      return <TableBody columns={data.columns} rows={data.rows} href={href} />;
    case 'empty':
      return <Centered>{data.reason ?? 'Nothing to show'}</Centered>;
    default:
      return <Centered>Not configured yet</Centered>;
  }
}
