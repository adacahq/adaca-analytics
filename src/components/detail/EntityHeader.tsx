'use client';

import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

/** Eyebrow (the kind), the value as the title, and a lede with site, period and share. */
export default function EntityHeader({ kindLabel, title, mono, lede }: { kindLabel: string; title: string; mono: boolean; lede: string }) {
  const router = useRouter();
  function back(e: React.MouseEvent) {
    e.preventDefault();
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  }
  return (
    <div>
      <div className="eyebrow-row rv">
        <a href="/" className="muted-link backlink" onClick={back}>
          ← Back
        </a>
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
