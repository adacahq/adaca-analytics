'use client';

import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Eyebrow (the kind), the value as the title, and a lede with site, period
 * and share. The back control is the chevron beside the eyebrow: the icon
 * points at the parent the eyebrow already names, so the pair reads as one
 * "back to Source / medium" and the title below stays flush with the lede
 * and the cards.
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
        <button type="button" className="backbtn" onClick={back} aria-label={`Back to ${kindLabel}`}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 4.5L7.5 12l7.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="eyebrow">{kindLabel}</span>
      </div>
      <h1 className={mono ? 'view-title mono rv' : 'view-title rv'} style={{ '--i': 1, overflowWrap: 'anywhere' } as CSSProperties}>
        {title}
      </h1>
      <p className="lede rv" style={{ '--i': 1 } as CSSProperties}>
        {lede}
      </p>
    </div>
  );
}
