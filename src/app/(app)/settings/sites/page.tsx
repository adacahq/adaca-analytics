import SubHead from '@/components/ui/SubHead';
import { listSites } from '@/lib/db/sites';

export const dynamic = 'force-dynamic';

export default async function SitesPage() {
  const sites = await listSites();
  return (
    <div>
      <SubHead title="Sites" action={<a href="/setup" className="btn btn-primary btn-sm">+ Add site</a>}>
        Each site is one GA4 property (and optionally its BigQuery export). {sites.length} on record.
      </SubHead>
      <div className="empty mt-6">
        <span className="zone-label">Sites</span>
        <p>The sites table lands with the setup wizard.</p>
      </div>
    </div>
  );
}
