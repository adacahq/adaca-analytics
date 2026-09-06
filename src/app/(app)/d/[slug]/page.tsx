import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import DashboardScreen from '@/components/dashboard/DashboardScreen';
import NewDashboardForm from '@/components/dashboard/NewDashboardForm';
import { listSites } from '@/lib/db/sites';
import type { SearchParams } from '@/lib/context';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const { slug } = await params;
  if (slug === 'new') {
    if ((await listSites()).length === 0) redirect('/setup');
    return (
      <div>
        <h1 className="view-title rv">New Dashboard</h1>
        <p className="lede rv" style={{ '--i': 1 } as CSSProperties}>
          Start with an empty board, or copy one of the six default dashboards and change it from there.
        </p>
        <div className="mt-8 rv" style={{ '--i': 2 } as CSSProperties}>
          <NewDashboardForm />
        </div>
      </div>
    );
  }
  if (slug === 'home') redirect('/');
  return <DashboardScreen slug={slug} searchParams={await searchParams} />;
}
