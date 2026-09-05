'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { selectSite } from '@/lib/context-actions';
import { Chevron, usePanel } from './usePanel';
import type { SiteOption } from './index';

/**
 * Which property the dashboards read. The choice lives in a cookie (set by
 * a server action) so every screen and every link agrees without carrying
 * a query param; the router refresh re-renders the server tree for the new
 * site.
 */
export default function SiteSwitcher({
  sites,
  currentSiteId,
  pathname,
}: {
  sites: SiteOption[];
  currentSiteId: string | null;
  pathname: string;
}) {
  const { ref, open, toggle, close } = usePanel<HTMLDivElement>(pathname);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = sites.find((s) => s.id === currentSiteId) ?? sites[0];

  function pick(id: string) {
    close();
    if (id === current?.id) return;
    startTransition(async () => {
      await selectSite(id);
      router.refresh();
    });
  }

  return (
    <div className="tbdrop" ref={ref}>
      <button
        type="button"
        className="tbbtn"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{ marginLeft: -12, opacity: pending ? 0.6 : 1 }}
      >
        <span className="tbsect">Site</span>
        <b title={current?.name}>{current?.name ?? 'No site'}</b>
        <Chevron />
      </button>
      {open ? (
        <div className="tbpanel" role="menu">
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitemradio"
              aria-checked={s.id === current?.id}
              className={s.id === current?.id ? 'tbrow on' : 'tbrow'}
              style={s.id === current?.id ? { color: 'var(--accent)', fontWeight: 500, background: 'color-mix(in srgb, var(--accent) 10%, transparent)' } : undefined}
              onClick={() => pick(s.id)}
            >
              {s.name}
            </button>
          ))}
          <span className="tbsep" aria-hidden />
          <Link href="/settings/sites" className="tbrow" onClick={close}>
            Manage sites
          </Link>
        </div>
      ) : null}
    </div>
  );
}
