'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TipData, TipEvent, TipTone } from '@/lib/tip';

/**
 * The one tooltip in the app: an instrument plate on the canvas palette,
 * mounted once in the root layout.
 *
 * Two ways in:
 *  - any element with a `data-tip` attribute (JSON via tip()) gets the plate
 *    on hover and keyboard focus — server components need no client code;
 *  - client charts dispatch `red:tip` CustomEvents (fireTip) to drive it.
 *
 * While pointer-driven it follows the cursor, clamped to the viewport;
 * focus-driven (or pinned) it anchors where it was placed.
 */

const TONES: Record<TipTone, string> = {
  accent: 'var(--accent)',
  accent2: 'color-mix(in srgb, var(--accent) 55%, var(--bg))',
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  muted: 'var(--muted)',
  fg: 'var(--fg)',
};

const OFF = 14;

function parse(raw: string | null): TipData | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as TipData;
    return typeof d === 'object' && d !== null ? d : null;
  } catch {
    return null;
  }
}

export default function VizTip() {
  const [tip, setTip] = useState<{ data: TipData; seq: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const followRef = useRef(true);
  const anchorRef = useRef<Element | null>(null);
  const visibleRef = useRef(false);
  const seqRef = useRef(0);

  function place() {
    const el = boxRef.current;
    if (!el) return;
    const { x, y } = posRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = x + OFF;
    let top = y + OFF;
    if (left + w > window.innerWidth - 10) left = Math.max(10, x - w - OFF);
    if (top + h > window.innerHeight - 10) top = Math.max(10, y - h - OFF);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  // Position the plate the moment it mounts or its content changes.
  useLayoutEffect(place, [tip]);

  useEffect(() => {
    const show = (data: TipData, x: number, y: number, pin: boolean) => {
      posRef.current = { x, y };
      followRef.current = !pin;
      // The entrance stamp plays once per appearance, not per content update.
      if (!visibleRef.current) seqRef.current += 1;
      visibleRef.current = true;
      setTip({ data, seq: seqRef.current });
    };
    const hide = () => {
      anchorRef.current = null;
      visibleRef.current = false;
      setTip(null);
    };

    const onOver = (e: PointerEvent) => {
      const hit = (e.target as Element | null)?.closest?.('[data-tip]') ?? null;
      if (hit === anchorRef.current) return;
      const data = hit && parse(hit.getAttribute('data-tip'));
      if (data) {
        anchorRef.current = hit;
        show(data, e.clientX, e.clientY, false);
      } else if (anchorRef.current) {
        hide();
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!followRef.current || !visibleRef.current) return;
      posRef.current = { x: e.clientX, y: e.clientY };
      place();
    };
    const onOut = (e: PointerEvent) => {
      const a = anchorRef.current;
      if (!a) return;
      const to = e.relatedTarget as Element | null;
      if ((!to || !a.contains(to)) && a.contains(e.target as Element)) hide();
    };
    const onFocus = (e: FocusEvent) => {
      const hit = (e.target as Element | null)?.closest?.('[data-tip]') ?? null;
      const data = hit && parse(hit.getAttribute('data-tip'));
      if (data) {
        const r = hit.getBoundingClientRect();
        anchorRef.current = hit;
        show(data, r.left + r.width / 2, r.bottom + 2, true);
      }
    };
    const onBlur = (e: FocusEvent) => {
      if (anchorRef.current && anchorRef.current.contains(e.target as Element)) hide();
    };
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<TipEvent | null>).detail;
      anchorRef.current = null;
      if (!detail) {
        visibleRef.current = false;
        setTip(null);
        return;
      }
      show(detail.data, detail.x, detail.y, detail.pin ?? false);
    };
    const onScroll = () => {
      if (anchorRef.current) hide();
    };

    document.addEventListener('pointerover', onOver, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerout', onOut, true);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    document.addEventListener('red:tip', onEvent);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerover', onOver, true);
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerout', onOut, true);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
      document.removeEventListener('red:tip', onEvent);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  if (!tip) return null;
  const { k, rows, n } = tip.data;
  return (
    <div ref={boxRef} key={tip.seq} className="viztip" role="tooltip">
      {k ? <span className="vk">{k}</span> : null}
      {(rows ?? []).map((r, i) => (
        <div key={i} className="vr">
          {r.tone ? (
            <i
              className={r.dashed ? 'vs dash' : 'vs'}
              style={{ borderTopColor: TONES[r.tone] ?? 'var(--accent)' }}
            />
          ) : null}
          <b>{r.v}</b>
          {r.l ? <span>{r.l}</span> : null}
        </div>
      ))}
      {n ? <span className="vn">{n}</span> : null}
    </div>
  );
}

/** Client charts drive the plate through this helper. */
export function fireTip(detail: TipEvent | null) {
  document.dispatchEvent(new CustomEvent('red:tip', { detail }));
}
