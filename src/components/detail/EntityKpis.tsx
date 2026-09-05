'use client';

import { METRIC_BY_KEY, type MetricKey } from '@/lib/analytics/metrics';
import { fmtDelta } from '@/lib/format';

export interface KpiItem {
  metric: MetricKey;
  value: number;
  previous: number | null;
}

/** The stat strip: every KPI of the entity with its delta against the period before. */
export default function EntityKpis({ kpis }: { kpis: KpiItem[] }) {
  return (
    <div className="stats" style={{ marginTop: 28 }}>
      {kpis.map((k) => {
        const m = METRIC_BY_KEY[k.metric];
        const delta = k.previous !== null ? fmtDelta(k.value, k.previous) : null;
        const dir = k.previous === null || k.previous === k.value ? 'flat' : k.value > k.previous ? 'up' : 'down';
        const tone = m.goodDirection === null || dir === 'flat' ? 'flat' : (dir === 'up') === (m.goodDirection === 'up') ? 'up' : 'down';
        return (
          <div key={k.metric} className="stat">
            <b>{m.format(k.value, true)}</b>
            <span>{m.label}</span>
            {delta !== null ? (
              <em className={`delta ${tone}`}>
                {delta}
                <small>vs prev</small>
              </em>
            ) : k.previous !== null ? (
              <em className="delta">— vs prev</em>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
