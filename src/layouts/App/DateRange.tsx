'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import DatePicker from '@/components/ui/DatePicker';
import { PRESETS, rangeToQuery, resolveRange, type DateRange as Range } from '@/lib/analytics/ranges';
import { fmtDay } from '@/lib/format';
import { Chevron, usePanel } from './usePanel';

/**
 * The period every dated widget reads. Lives in the URL (`?range=7d`,
 * `?from=&to=`, `&compare=1`) so a dashboard link reproduces the view; the
 * server resolves the same params for the site's own "today", which is
 * passed down here only to label the button identically on both sides.
 */
export default function DateRange({ today, pathname }: { today: string; pathname: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname() ?? pathname;
  const { ref, open, toggle, close } = usePanel<HTMLDivElement>(pathname);

  const range = resolveRange(
    { range: params?.get('range'), from: params?.get('from'), to: params?.get('to'), compare: params?.get('compare') },
    today,
  );
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  function go(next: Range) {
    const q = rangeToQuery(next);
    // Keep unrelated params (none today, but a future ?tab= should survive).
    const keep = new URLSearchParams(params?.toString());
    for (const k of ['range', 'from', 'to', 'compare']) keep.delete(k);
    for (const [k, v] of q) keep.set(k, v);
    const qs = keep.toString();
    router.push(qs ? `${path}?${qs}` : path);
    close();
  }

  const label = range.key === 'custom' ? `${fmtDay(range.from)} – ${fmtDay(range.to)}` : range.label;

  return (
    <div className="tbdrop" ref={ref}>
      <button type="button" className="tbbtn" onClick={toggle} aria-expanded={open} aria-haspopup="dialog">
        <span className="tbsect">Period</span>
        <b>{label}</b>
        {range.compare ? <span className="tbsect" style={{ color: 'var(--accent)' }}>vs prev</span> : null}
        <Chevron />
      </button>
      {open ? (
        <div className="tbpanel range center" role="dialog" aria-label="Choose a period">
          <span className="plabel">Presets</span>
          <div className="seg">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={range.key === p.key ? 'on' : undefined}
                onClick={() => go({ ...range, key: p.key, from: '', to: '', label: p.label })}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="plabel">Custom</span>
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker value={from} onChange={setFrom} ariaLabel="From" />
            <span className="mono-micro">to</span>
            <DatePicker value={to} onChange={setTo} ariaLabel="To" />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!from || !to}
              onClick={() => go({ key: 'custom', from: from <= to ? from : to, to: from <= to ? to : from, compare: range.compare, label: '' })}
            >
              Apply
            </button>
          </div>
          <label className="check" style={{ padding: '4px 4px 0' }}>
            <input type="checkbox" checked={range.compare} onChange={(e) => go({ ...range, compare: e.target.checked })} />
            Compare to previous period
          </label>
        </div>
      ) : null}
    </div>
  );
}
