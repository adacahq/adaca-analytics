'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { selectSite } from '@/lib/context-actions';
import type { SiteOption } from './index';

/**
 * The site picker at the bottom of the drawer (small screens only; the
 * topbar switcher hides there). Rows in the rail's own grammar: the current
 * site reads as the active row, a tap switches and closes the drawer.
 */
export default function DrawerSites({ sites, currentSiteId, onDone }: { sites: SiteOption[]; currentSiteId: string | null; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (sites.length === 0) return null;
  const current = sites.find((s) => s.id === currentSiteId) ?? sites[0];

  function pick(id: string) {
    if (id === current.id) {
      onDone();
      return;
    }
    startTransition(async () => {
      await selectSite(id);
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="grp sbsites" style={{ opacity: pending ? 0.6 : 1 }}>
      <span className="glabel">Site</span>
      {sites.map((s) => (
        <div className="sect" key={s.id}>
          <button type="button" className={s.id === current.id ? 'nv on' : 'nv'} onClick={() => pick(s.id)} aria-current={s.id === current.id ? 'true' : undefined} disabled={pending}>
            <span>{s.name}</span>
          </button>
        </div>
      ))}
      <div className="sect">
        <Link href="/settings/sites" className="sv" onClick={onDone}>
          <span>Manage sites</span>
        </Link>
      </div>
    </div>
  );
}
