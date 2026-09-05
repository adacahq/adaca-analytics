'use client';

import {
  HTMLAttributes,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface TabDef {
  key: string;
  label: string;
  content: ReactNode;
}

/** The tab tray. Renders `.tabs`, a single sliding `.ind` tile, and the
 *  tabs themselves; the tile tracks whichever child carries `.active`,
 *  re-measured after every commit, so callers only toggle that class. */
export function TabRail({
  className,
  children,
  ...rest
}: {
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'>) {
  const ref = useRef<HTMLDivElement>(null);

  function measure() {
    const rail = ref.current;
    if (!rail) return;
    const ind = rail.querySelector<HTMLSpanElement>('.ind');
    if (!ind) return;
    const on = rail.querySelector<HTMLElement>('.active');
    if (!on) {
      ind.style.width = '0';
      ind.style.height = '0';
      return;
    }
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.height = `${on.offsetHeight}px`;
    ind.style.top = `${on.offsetTop}px`;
    ind.style.transform = `translateX(${on.offsetLeft}px)`;
  }

  // The SSR/pre-hydration frame shows the CSS fallback fill on the active
  // tab (`.tabs:not(.js) button.active`); this measures the tile into the
  // identical position before the first paint, then stamps `.js` — so the
  // fallback-to-tile handoff is invisible and never animates from 0.
  // No dependency array on purpose: the stamp is a DOM mutation outside
  // React's className, so any re-render that rewrites `class` (a caller
  // whose className changes) would drop it — re-stamping after every commit
  // is idempotent, a few reads, and self-healing.
  useLayoutEffect(() => {
    ref.current?.classList.add('js');
    measure();
  });

  useEffect(() => {
    const rail = ref.current;
    if (!rail) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(rail);
    for (const child of Array.from(rail.children)) {
      if (child.tagName === 'BUTTON' || child.tagName === 'A') ro.observe(child);
    }
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={`tabs${className ? ` ${className}` : ''}`} ref={ref} {...rest}>
      <span className="ind" aria-hidden="true" />
      {children}
    </div>
  );
}

/** In-page tabs that switch server-rendered content; active tab synced to ?tab=. */
export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlTab = params?.get('tab');
  const [active, setActive] = useState<string>(
    tabs.find((t) => t.key === urlTab)?.key ?? tabs[0]?.key ?? '',
  );

  function select(key: string) {
    setActive(key);
    const next = new URLSearchParams(params?.toString());
    next.set('tab', key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <TabRail className="mt-6" role="tablist">
        {tabs.map((t) => {
          const on = t.key === (current?.key ?? '');
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(t.key)}
              className={on ? 'active' : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </TabRail>
      <div role="tabpanel" className="tab-panel">
        {current?.content}
      </div>
    </div>
  );
}

/** Route-based tabs (navigate between pages); active by pathname prefix. */
export function TabLinks({
  tabs,
  className = 'mb-8',
}: {
  tabs: { href: string; label: string }[];
  className?: string;
}) {
  const pathname = usePathname() ?? '';
  return (
    <TabRail className={className}>
      {tabs.map((t) => {
        const on = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} className={on ? 'active' : undefined}>
            {t.label}
          </Link>
        );
      })}
    </TabRail>
  );
}
