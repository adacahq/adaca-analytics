'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtDay, fmtInt } from '@/lib/format';

export interface RunProgress {
  id: string;
  site_id: string;
  kind: string;
  from: string;
  to: string;
  units: number;
  total: number;
  rows: number;
  status: string;
}

/**
 * Shown while a site has queued/running ingestion. It is also the browser-
 * side PUMP: each poll POSTs to /api/ingest/advance, which does a bounded
 * unit of work and returns progress, so a backfill completes in minutes
 * without waiting for cron. When the queue drains it refreshes the page so
 * widgets pick up the new rollups.
 */
export default function IngestBanner({ siteId, initial, all = false }: { siteId?: string; initial: RunProgress[]; all?: boolean }) {
  const [runs, setRuns] = useState<RunProgress[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      if (!alive.current) return;
      try {
        const q = siteId && !all ? `?site=${encodeURIComponent(siteId)}` : '';
        const res = await fetch(`/api/ingest/advance${q}`, { method: 'POST' });
        const body = (await res.json()) as { progress: RunProgress[]; failed?: { id: string; error: string }[] };
        if (!alive.current) return;
        setRuns(body.progress);
        const failed = body.failed?.find((f) => !f.error.startsWith('quota'));
        if (failed) setError(failed.error);
        if (body.progress.length === 0) {
          router.refresh();
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      timer = setTimeout(tick, 400);
    }
    if (initial.length > 0) timer = setTimeout(tick, 50);
    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
    };
    // Re-arm only when the set of runs we were handed changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, all, initial.map((r) => r.id).join(',')]);

  if (error) {
    return (
      <div className="alert error rv" role="alert">
        Ingestion stopped: {error}
      </div>
    );
  }
  if (runs.length === 0) return null;
  const r = runs[0];
  const pct = r.total > 0 ? Math.min(100, Math.round((r.units / r.total) * 100)) : 0;
  const label = r.kind === 'backfill' ? 'Backfilling' : r.kind === 'refresh' ? 'Refreshing' : 'Ingesting';
  return (
    <div className="alert rv" role="status" aria-live="polite" style={{ flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="spinner" aria-hidden />
        <span style={{ color: 'var(--fg)' }}>
          {label} {fmtDay(r.from)} → {fmtDay(r.to)}
        </span>
        <span className="mono-micro">
          {r.units}/{r.total || '?'} units · {fmtInt(r.rows)} rows
          {runs.length > 1 ? ` · ${runs.length - 1} more queued` : ''}
        </span>
      </div>
      <div className="pbar">
        <i style={{ '--w': `${pct}%` } as React.CSSProperties} />
      </div>
    </div>
  );
}
