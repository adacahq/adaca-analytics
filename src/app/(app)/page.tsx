import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { listSites } from '@/lib/db/sites';
import { currentSite, rangeFor, rangeParams, type SearchParams } from '@/lib/context';
import { fmtDay } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sites = await listSites();
  const site = await currentSite(sites);
  if (!site) redirect('/setup');
  const range = rangeFor(site, rangeParams(await searchParams));

  return (
    <div>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <h1 className="view-title rv">Home</h1>
        <span className="rv flex items-center gap-3" style={{ '--i': 1 } as CSSProperties}>
          <button type="button" className="btn btn-ghost btn-sm">Customise</button>
        </span>
      </div>
      <p className="lede rv" style={{ '--i': 1 } as CSSProperties}>
        {site.name} · {fmtDay(range.from)} to {fmtDay(range.to)}. Dashboard widgets arrive in the next phase.
      </p>
      <div className="mt-10 stats rv" style={{ '--i': 2 } as CSSProperties}>
        <div className="stat"><b>—</b><span>Visitors</span></div>
        <div className="stat"><b>—</b><span>Visits</span></div>
        <div className="stat"><b>—</b><span>Pageviews</span></div>
        <div className="stat"><b>—</b><span>Key events</span></div>
      </div>
    </div>
  );
}
