'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { METRIC_BY_KEY, type MetricKey } from '@/lib/analytics/metrics';
import type { Bucket, Point } from '@/lib/dashboard/types';
import { fmtBucket } from '@/lib/format';

const axisTick = { fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--muted)' };
const TOOLTIP = { fontSize: 12, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--fg)', fontFamily: 'var(--font-mono)' };

/** The lead metric over the period, with the period before dashed behind it. */
export default function EntityTrend({ metricKey, bucket, points, title }: { metricKey: MetricKey; bucket: Bucket; points: Point[]; title: string }) {
  const metric = METRIC_BY_KEY[metricKey];
  const compare = points.some((p) => p.previous !== undefined);
  const fmtX = (v: string) => fmtBucket(v, bucket);
  return (
    <div className="chart-card">
      <div className="mono-micro" style={{ marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line)' }} tickFormatter={fmtX} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => metric.format(Number(v), true)} />
            <Tooltip contentStyle={TOOLTIP} labelFormatter={(l) => fmtX(String(l))} formatter={(v, name) => [metric.format(Number(v)), name === 'previous' ? 'Previous period' : metric.label]} />
            {compare ? <Line type="monotone" dataKey="previous" stroke="var(--series-3)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} /> : null}
            <Line type="monotone" dataKey="value" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
