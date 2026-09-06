'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { liveCount } from '@/lib/analytics/live-actions';

const EVERY_MS = 30_000;

/** People on the site right now, on every screen; opens the Realtime dashboard. Polls the 30 s cache. */
export default function LiveChip({ siteId }: { siteId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      const n = await liveCount(siteId);
      if (alive) setCount(n);
    }
    void tick();
    const timer = setInterval(() => void tick(), EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [siteId]);

  if (count === null) return null;
  return (
    <Link href="/d/realtime" className="tblive" title="On the site in the last 30 minutes">
      <span className="rag g" aria-hidden />
      <b>{count}</b>
      <span className="tbsect">live</span>
    </Link>
  );
}
