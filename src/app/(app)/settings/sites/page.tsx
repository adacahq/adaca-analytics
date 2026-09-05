import Link from 'next/link';
import SubHead from '@/components/ui/SubHead';
import SitesTable from '@/components/settings/SitesTable';
import { listSites } from '@/lib/db/sites';
import { rollupSpan } from '@/lib/analytics/rollups';

export const dynamic = 'force-dynamic';

export default async function SitesPage() {
  const sites = await listSites();
  const rows = await Promise.all(
    sites.map(async (s) => {
      const span = await rollupSpan(s.id);
      return { ...s, rows: span.rows, span: { from: span.from, to: span.to } };
    }),
  );
  return (
    <div>
      <SubHead
        title="Sites"
        action={
          <Link href="/setup" className="btn btn-primary btn-sm">
            + Add site
          </Link>
        }
      >
        Each site is one GA4 property or one BigQuery export, with its own timezone and history. {sites.length === 1 ? '1 site' : `${sites.length} sites`} on record.
      </SubHead>
      <div className="mt-6">
        <SitesTable sites={rows} />
      </div>
    </div>
  );
}
