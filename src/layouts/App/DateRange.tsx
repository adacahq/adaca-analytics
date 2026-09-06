'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import DatePicker from '@/components/ui/DatePicker';
import { PRESETS, compareCaption, rangeToQuery, resolveRange, type CompareMode, type DateRange as Range } from '@/lib/analytics/ranges';
import { fmtDay } from '@/lib/format';
import { Chevron, usePanel } from './usePanel';

const COMPARES: { key: CompareMode | ''; label: string }[] = [
  { key: '', label: 'Off' },
  { key: 'prev', label: 'Previous period' },
  { key: 'yoy', label: 'Same period last year' },
  { key: 'custom', label: 'Custom' },
];

/** True when a key press belongs to a field or a dialog, not to the page. */
function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return !!document.querySelector('.overlay');
}

/**
 * The period every dated widget reads. Lives in the URL (`?range=7d`,
 * `?from=&to=`, `&compare=prev|yoy|from..to`) so a dashboard link reproduces
 * the view; the server resolves the same params for the site's own "today",
 * which is passed down here only to label the button identically on both
 * sides. Every preset has a one-letter shortcut (shown beside it); X toggles
 * the comparison and C opens the custom fields.
 */
export default function DateRange({ today, earliest, pathname }: { today: string; earliest: string | null; pathname: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname() ?? pathname;
  const { ref, open, toggle, close } = usePanel<HTMLDivElement>(pathname);

  const range = resolveRange(
    { range: params?.get('range'), from: params?.get('from'), to: params?.get('to'), compare: params?.get('compare') },
    today,
    { earliest },
  );
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [cFrom, setCFrom] = useState(range.against?.from ?? range.from);
  const [cTo, setCTo] = useState(range.against?.to ?? range.to);
  const [customCompare, setCustomCompare] = useState(range.compare === 'custom');

  function go(next: Range) {
    const q = rangeToQuery(next);
    // Keep unrelated params (the segment, a future ?tab=).
    const keep = new URLSearchParams(params?.toString());
    for (const k of ['range', 'from', 'to', 'compare']) keep.delete(k);
    for (const [k, v] of q) keep.set(k, v);
    const qs = keep.toString();
    router.push(qs ? `${path}?${qs}` : path);
    close();
  }
  function preset(key: (typeof PRESETS)[number]['key']) {
    const p = PRESETS.find((x) => x.key === key)!;
    go({ ...range, key: p.key, from: '', to: '', label: p.label });
  }
  function compare(mode: CompareMode | '') {
    if (mode === 'custom') {
      setCustomCompare(true);
      return;
    }
    setCustomCompare(false);
    go({ ...range, compare: mode || null, against: null });
  }
  function applyCustomCompare() {
    const a = cFrom <= cTo ? cFrom : cTo;
    const b = cFrom <= cTo ? cTo : cFrom;
    go({ ...range, compare: 'custom', against: { from: a, to: b } });
  }

  // Keyboard shortcuts, Plausible-style: a letter per preset, X for compare, C for custom.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
      const k = e.key.toUpperCase();
      const p = PRESETS.find((x) => x.shortcut === k);
      if (p) {
        e.preventDefault();
        preset(p.key);
      } else if (k === 'X') {
        e.preventDefault();
        compare(range.compare ? '' : 'prev');
      } else if (k === 'C' && !open) {
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // The handlers close over the current range and open state on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.key, range.from, range.to, range.compare, open, path, params]);

  const label = range.key === 'custom' ? `${fmtDay(range.from)} – ${fmtDay(range.to)}` : range.label;
  const compareOn = customCompare ? 'custom' : (range.compare ?? '');

  return (
    <div className="tbdrop" ref={ref}>
      <button type="button" className="tbbtn" onClick={toggle} aria-expanded={open} aria-haspopup="dialog">
        <span className="tbsect">Period</span>
        <b>{label}</b>
        {range.compare ? <span className="tbsect" style={{ color: 'var(--accent)' }}>{compareCaption(range.compare)}</span> : null}
        <Chevron />
      </button>
      {open ? (
        <div className="tbpanel range center" role="dialog" aria-label="Choose a period">
          <span className="plabel">Presets</span>
          <div className="seg">
            {PRESETS.map((p) => (
              <button key={p.key} type="button" className={range.key === p.key ? 'on' : undefined} onClick={() => preset(p.key)} title={`Shortcut: ${p.shortcut}`}>
                {p.label}
                <kbd className="kb">{p.shortcut}</kbd>
              </button>
            ))}
          </div>
          <span className="plabel">
            Custom <kbd className="kb">C</kbd>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker value={from} onChange={setFrom} ariaLabel="From" />
            <span className="mono-micro">to</span>
            <DatePicker value={to} onChange={setTo} ariaLabel="To" />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!from || !to}
              onClick={() => go({ ...range, key: 'custom', from: from <= to ? from : to, to: from <= to ? to : from, label: '' })}
            >
              Apply
            </button>
          </div>
          <span className="plabel">
            Compare <kbd className="kb">X</kbd>
          </span>
          <div className="seg">
            {COMPARES.map((c) => (
              <button key={c.key} type="button" className={compareOn === c.key ? 'on' : undefined} onClick={() => compare(c.key)}>
                {c.label}
              </button>
            ))}
          </div>
          {customCompare ? (
            <div className="flex flex-wrap items-center gap-2">
              <DatePicker value={cFrom} onChange={setCFrom} ariaLabel="Compare from" />
              <span className="mono-micro">to</span>
              <DatePicker value={cTo} onChange={setCTo} ariaLabel="Compare to" />
              <button type="button" className="btn btn-ghost btn-sm" disabled={!cFrom || !cTo} onClick={applyCustomCompare}>
                Compare
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
