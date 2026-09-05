'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { METRIC_BY_KEY, type MetricKey } from '@/lib/analytics/metrics';
import type { Bucket, Point } from '@/lib/dashboard/types';
import { fmtBucket } from '@/lib/format';
import { ChartFrame, ChartTip, LinkTick, SERIES, axisTick, bucketNoun, clickedName, useNarrow } from '@/components/dashboard/chart-helpers';

/**
 * The lead metric over the period, with the period before dashed behind it.
 * A click on the plot (or a date label) narrows this page to that bucket.
 */
export default function EntityTrend({ metricKey, bucket, points, title, from, to }: { metricKey: MetricKey; bucket: Bucket; points: Point[]; title: string; from: string; to: string }) {
  const metric = METRIC_BY_KEY[metricKey];
  const compare = points.some((p) => p.previous !== undefined);
  const fmtX = (v: string) => fmtBucket(v, bucket);
  const narrow = useNarrow(bucket, from, to);
  return (
    <div className="chart-card">
      <div className="mono-micro" style={{ marginBottom: 12 }}>
        {title}
      </div>
      <ChartFrame clickable={!!narrow} height={220}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
            onClick={(state) => {
              const name = clickedName(state);
              if (name !== null && narrow) narrow(name);
            }}
          >
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="name" tick={(p) => <LinkTick {...p} format={fmtX} onOpen={narrow} />} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => metric.format(Number(v), true)} />
            <Tooltip content={<ChartTip title={fmtX} row={(v, k) => [metric.format(v), k === 'previous' ? 'Previous period' : metric.label]} hint={narrow ? `Click to narrow to this ${bucketNoun(bucket)}` : null} />} />
            {compare ? <Line type="monotone" dataKey="previous" stroke={SERIES[2]} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} /> : null}
            <Line type="monotone" dataKey="value" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
