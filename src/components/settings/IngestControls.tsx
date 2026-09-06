'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Select from '@/components/ui/Select';
import { useConfirm } from '@/components/ui/Confirm';
import { addDrilldownData, backfillMissingFamilies, backfillSite, refreshNow } from '@/lib/setup/actions';
import type { Site } from '@/lib/db/sites';

export interface PairCoverage {
  rows: number;
  from: string | null;
  to: string | null;
}

/** Per-site controls on Settings → Ingestion: refresh the trailing days, add drill-down data or newly added reports, or re-backfill. */
export default function IngestControls({ site, busy, pairs, missing }: { site: Site; busy: boolean; pairs: PairCoverage; missing: string[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [days, setDays] = useState(String(site.backfill_days));
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const r = await refreshNow(site.id);
      if (r.ok) {
        toast.success('Refresh queued');
        router.refresh();
      } else toast.error(r.error);
    });
  }

  async function drilldown() {
    const ok = await confirm({
      title: `Add drill-down data to ${site.name}?`,
      body: pairs.rows
        ? 'Re-ingest the 17 two-dimension families over the days this site already holds. Existing drill-down rows for those days are replaced; the single-dimension rollups are left alone.'
        : 'Ingest the 17 two-dimension families (source × page, page × country, …) over the days this site already holds, so every source, page and country opens into a detail page. The single-dimension rollups are left alone.',
      confirmLabel: 'Add drill-down data',
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await addDrilldownData(site.id);
      if (r.ok) {
        toast.success('Drill-down data queued');
        router.refresh();
      } else toast.error(r.error);
    });
  }

  async function addMissing() {
    const ok = await confirm({
      title: `Add ${missing.length} new ${missing.length === 1 ? 'report' : 'reports'} to ${site.name}?`,
      body: `${missing.join(', ')}: report families added to the app after this site was backfilled. They are ingested over the days the site already holds; nothing else is touched.`,
      confirmLabel: 'Add reports',
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await backfillMissingFamilies(site.id);
      if (r.ok) {
        toast.success('New reports queued');
        router.refresh();
      } else toast.error(r.error);
    });
  }

  async function backfill() {
    const ok = await confirm({
      title: `Backfill ${site.name}?`,
      body: `Re-ingest the last ${days} days. Existing rows for those days are replaced, and anything queued for this site is cancelled.`,
      confirmLabel: 'Start backfill',
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await backfillSite(site.id, { days: Number(days) });
      if (r.ok) {
        toast.success('Backfill queued');
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending || busy} onClick={refresh}>
        Refresh now
      </button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending || busy} onClick={drilldown} title={pairs.rows ? `${pairs.rows.toLocaleString()} drill-down rows` : 'No drill-down data yet'}>
        {pairs.rows ? 'Rebuild drill-down data' : 'Add drill-down data'}
      </button>
      {missing.length > 0 ? (
        <button type="button" className="btn btn-primary btn-sm" disabled={pending || busy} onClick={addMissing} title={missing.join(', ')}>
          Add {missing.length} new {missing.length === 1 ? 'report' : 'reports'}
        </button>
      ) : null}
      <Select
        value={days}
        onChange={setDays}
        ariaLabel="Backfill days"
        options={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
          { value: '90', label: '90 days' },
          { value: '180', label: '180 days' },
          { value: '365', label: '365 days' },
        ]}
      />
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={backfill}>
        Backfill
      </button>
    </div>
  );
}
