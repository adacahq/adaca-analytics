'use client';

import { useMemo, useState } from 'react';
import { TableBody, useDrill } from '@/components/dashboard/WidgetBody';
import { DATASET_BY_KEY } from '@/lib/analytics/catalog';
import { METRIC_BY_KEY, isMetricKey } from '@/lib/analytics/metrics';
import { fmtInt } from '@/lib/format';

export interface ExploreColumn {
  key: string;
  label: string;
  metric: boolean;
}

/**
 * The full table behind a card: every row the period holds (up to 500),
 * every metric of the dataset, a share column on the lead metric, client-side
 * search, column sorting (the table's own), and a CSV download. Rows drill
 * like they do on dashboards.
 */
export default function ExploreView({ datasetKey, columns, rows, metric, total }: { datasetKey: string; columns: ExploreColumn[]; rows: Record<string, string | number>[]; metric: string; total: number }) {
  const ds = DATASET_BY_KEY[datasetKey];
  const href = useDrill(ds);
  const [q, setQ] = useState('');

  const withShare = useMemo<Record<string, string | number>[]>(() => {
    const m = isMetricKey(metric) ? METRIC_BY_KEY[metric] : null;
    const shareable = !!m && m.kind === 'sum' && total > 0;
    return rows.map((r) => ({ ...r, share: shareable ? Number(r[metric]) / total : 0 }));
  }, [rows, metric, total]);
  const cols = useMemo<ExploreColumn[]>(() => {
    const m = isMetricKey(metric) ? METRIC_BY_KEY[metric] : null;
    const shareable = !!m && m.kind === 'sum' && total > 0;
    if (!shareable) return columns;
    const i = columns.findIndex((c) => c.key === metric);
    const share = { key: 'share', label: '%', metric: true };
    return i === -1 ? [...columns, share] : [...columns.slice(0, i + 1), share, ...columns.slice(i + 1)];
  }, [columns, metric, total]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return withShare;
    return withShare.filter((r) => String(r.name).toLowerCase().includes(needle) || String(r.sub ?? '').toLowerCase().includes(needle));
  }, [withShare, q]);

  function download() {
    const head = cols.map((c) => (c.key === 'share' ? 'Share' : c.label));
    const lines = [head, ...shown.map((r) => cols.map((c) => (c.key === 'name' ? `${r.name}${r.sub ? ` (${r.sub})` : ''}` : c.key === 'share' ? (Number(r.share) * 100).toFixed(2) : String(r[c.key] ?? ''))))];
    const csv = lines.map((l) => l.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${datasetKey.replace('.', '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="explore chart-card">
      <div className="tools">
        <div className="field">
          <input value={q} placeholder="Search rows" onChange={(e) => setQ(e.target.value)} aria-label="Search rows" />
        </div>
        <span className="micro">
          {fmtInt(shown.length)} of {fmtInt(rows.length)} rows
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={download} disabled={shown.length === 0}>
          Download CSV
        </button>
      </div>
      <TableBody columns={cols} rows={shown} href={href} />
    </div>
  );
}
