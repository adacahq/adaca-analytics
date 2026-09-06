import { ReactNode } from 'react';
import AppShell from '@/layouts/App';
import { listSites } from '@/lib/db/sites';
import { listDashboards } from '@/lib/db/dashboards';
import { currentSite } from '@/lib/context';
import { todayInZone } from '@/lib/analytics/ranges';
import { ensureDefaultDashboards } from '@/lib/dashboard/seed';
import { listSegments } from '@/lib/db/segments';
import { earliestDate } from '@/lib/analytics/rollups';

export const dynamic = 'force-dynamic';

/**
 * The shell for every app screen. Loads what the rail and topbar need (sites,
 * dashboards, the current site's "today") once per request; pages redirect to
 * /setup themselves when there is no site yet (a layout cannot read the path).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  await ensureDefaultDashboards();
  const [sites, dashboards, segments] = await Promise.all([listSites(), listDashboards(), listSegments()]);
  const site = await currentSite(sites);
  const today = todayInZone(site?.timezone ?? 'UTC');
  const earliest = site ? await earliestDate(site.id) : null;

  return (
    <AppShell
      sites={sites.map((s) => ({ id: s.id, name: s.name, timezone: s.timezone, hasRealtime: !!s.ga_property_id }))}
      currentSiteId={site?.id ?? null}
      today={today}
      earliest={earliest}
      segments={segments.map((s) => ({ id: s.id, name: s.name, kind: s.kind, op: s.op, value: s.value }))}
      dashboards={dashboards.map((d) => ({ slug: d.slug, name: d.name, kind: d.kind }))}
    >
      {children}
    </AppShell>
  );
}
