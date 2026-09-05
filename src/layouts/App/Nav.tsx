'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { sectionOn, viewOn } from '@/lib/nav';
import type { NavGroup, NavSection } from '@/lib/nav';

function Chevron() {
  return (
    <svg viewBox="0 0 10 6" aria-hidden>
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Plus() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden>
      <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Dashboard links carry the current range query so switching boards keeps the period. */
function keepQuery(href: string, search: string): string {
  if (!search || href.startsWith('/settings') || href === '/d/new') return href;
  return `${href}?${search}`;
}

/**
 * The rail's group/section tree (`nav.ts`). A section with more than one
 * view wears a chevron (Settings); dashboards are one-view sections. The
 * active section opens by default; a closed section's chevron peeks at what
 * sits beneath it without leaving the current screen. No icons — the rail
 * is text-only.
 */
export default function Nav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname() ?? '/';
  const search = useSearchParams()?.toString() ?? '';
  const [flips, setFlips] = useState<{ keys: string[]; at: string } | null>(null);
  const flipped = flips && flips.at === pathname ? flips.keys : [];
  function flip(key: string) {
    const keys = flipped.includes(key) ? flipped.filter((k) => k !== key) : [...flipped, key];
    setFlips({ keys, at: pathname });
  }

  function sectionItem(s: NavSection) {
    const views = s.views;
    if (!views.length) return null;
    const on = sectionOn(s, pathname);
    const multi = views.length > 1;
    const expanded = multi && on !== flipped.includes(s.key);
    return (
      <div className={multi ? 'sect chv' : 'sect'} key={s.key}>
        <Link href={keepQuery(views[0].href, search)} className={on ? 'nv on' : 'nv'}>
          <span>{s.label}</span>
        </Link>
        {multi ? (
          <button
            type="button"
            className="chev"
            onClick={() => flip(s.key)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} ${s.label} views`}
          >
            <Chevron />
          </button>
        ) : null}
        {multi ? (
          <div className={expanded ? 'views x' : 'views'} inert={!expanded}>
            <div>
              {views.map((v) => (
                <Link key={v.href} href={keepQuery(v.href, search)} className={on && viewOn(v, pathname) ? 'sv on' : 'sv'}>
                  <span>{v.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function groupItem(g: NavGroup) {
    const sections = g.sections.map((s) => sectionItem(s)).filter(Boolean);
    if (sections.length === 0 && !g.add) return null;
    return (
      <div className={g.footer ? 'grp mt-auto' : 'grp'} key={g.key}>
        {g.label ? (
          g.add ? (
            <div className="sect addable" style={{ minHeight: 36, display: 'flex', alignItems: 'center' }}>
              <span className="glabel" style={{ paddingBottom: 8 }}>{g.label}</span>
              <Link href={g.add.href} className="add" aria-label={g.add.label} title={g.add.label}>
                <Plus />
              </Link>
            </div>
          ) : (
            <span className="glabel">{g.label}</span>
          )
        ) : null}
        {sections}
        {sections.length === 0 && g.add ? (
          <Link href={g.add.href} className="sv" style={{ paddingLeft: 10 }}>
            <span>+ {g.add.label}</span>
          </Link>
        ) : null}
      </div>
    );
  }

  const mainGroups = groups.filter((g) => !g.footer);
  const footerGroups = groups.filter((g) => g.footer);

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col">
      {mainGroups.map((g) => groupItem(g))}
      {footerGroups.map((g) => groupItem(g))}
    </nav>
  );
}
