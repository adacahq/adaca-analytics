import SubHead from '@/components/ui/SubHead';
import ReportsPanel from '@/components/settings/ReportsPanel';
import { listReports } from '@/lib/db/reports';
import { listSites } from '@/lib/db/sites';
import { emailConfigured } from '@/lib/reports/env';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const [reports, sites] = await Promise.all([listReports(), listSites()]);
  return (
    <div>
      <SubHead title="Reports">
        Weekly and monthly summaries, and traffic spike or drop alerts, by email or to a Slack channel. The cron delivers them; nothing needs to be open.
      </SubHead>
      <div className="mt-6">
        <ReportsPanel reports={reports} sites={sites.map((s) => ({ id: s.id, name: s.name, hasRealtime: !!s.ga_property_id }))} emailConfigured={emailConfigured()} />
      </div>
    </div>
  );
}
