'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Select from '@/components/ui/Select';
import { useConfirm } from '@/components/ui/Confirm';
import { backfillSite, refreshNow } from '@/lib/setup/actions';
import type { Site } from '@/lib/db/sites';

/** Per-site controls on Settings → Ingestion: refresh the trailing days, or re-backfill. */
export default function IngestControls({ site, busy }: { site: Site; busy: boolean }) {
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

  async function backfill() {
    const ok = await confirm({
      title: `Backfill ${site.name}?`,
      body: `Re-ingest the last ${days} days. Existing rows for those days are replaced; anything queued for this site is cancelled.`,
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
