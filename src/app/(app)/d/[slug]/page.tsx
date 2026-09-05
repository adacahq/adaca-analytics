import type { CSSProperties } from 'react';
import { notFound, redirect } from 'next/navigation';
import { listSites } from '@/lib/db/sites';
import { getDashboard } from '@/lib/db/dashboards';
import { currentSite } from '@/lib/context';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sites = await listSites();
  const site = await currentSite(sites);
  if (!site) redirect('/setup');
  if (slug === 'new') {
    return (
      <div>
        <h1 className="view-title rv">New dashboard</h1>
        <p className="lede rv" style={{ '--i': 1 } as CSSProperties}>Start blank or from a template. Arrives with the dashboards phase.</p>
      </div>
    );
  }
  const dashboard = await getDashboard(slug);
  if (!dashboard) notFound();
  return (
    <div>
      <h1 className="view-title rv">{dashboard.name}</h1>
      <p className="lede rv" style={{ '--i': 1 } as CSSProperties}>{site.name}. Widgets arrive in the dashboards phase.</p>
    </div>
  );
}
