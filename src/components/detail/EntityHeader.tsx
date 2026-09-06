'use client';

import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Eyebrow (the kind), the value as the title with the back control beside it,
 * and a lede with site, period and share. The chevron is hung by its own
 * stroke, not its hover halo, so the eyebrow above and the lede below still
 * read as one left edge and only the title steps in.
 */
export default function EntityHeader({ kindLabel, title, mono, lede }: { kindLabel: string; title: string; mono: boolean; lede: string }) {
  const router = useRouter();
  function back() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  }
  return (
    <div>
      <div className="eyebrow-row rv">
        <span className="eyebrow">{kindLabel}</span>
      </div>
      <div className="title-row rv" style={{ '--i': 1 } as CSSProperties}>
        <button type="button" className="backbtn" onClick={back} aria-label={`Back to ${kindLabel}`}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 4.5L7.5 12l7.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className={mono ? 'view-title mono' : 'view-title'} style={{ overflowWrap: 'anywhere' }}>
          {title}
        </h1>
      </div>
      <p className="lede rv" style={{ '--i': 1 } as CSSProperties}>
        {lede}
      </p>
    </div>
  );
}
