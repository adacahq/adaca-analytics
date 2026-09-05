'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Everything the motion system drives. */
const SELECTOR = '.rv, [data-draw], [data-count]';

/**
 * The site's motion system (website/src/scripts/canvas-2026.js), adapted.
 * Reveals (.rv), stroke draw-ins ([data-draw]) and figure count-ins
 * ([data-count]) — all gated on the .canvas-motion class the head script
 * sets before paint. Reduced motion / no JS ⇒ finished state, always.
 *
 * Scans on every route change AND watches for elements that arrive later.
 * The late-arrival watch is not an optimisation, it is the correctness
 * requirement: a segment with a loading.tsx commits the pathname change
 * with its Suspense fallback on screen, so a pathname-only scan runs
 * against the skeleton and never sees the page. `.canvas-motion .rv` is
 * `opacity: 0` until we stamp `.in`, so anything streamed in after that
 * scan stays invisible forever.
 */
export default function CanvasMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const noIO = typeof IntersectionObserver === 'undefined';

    function finalCount(el: HTMLElement): string {
      return `${el.dataset.count ?? ''}${el.dataset.suffix ?? ''}`;
    }

    /** Still owed an entrance? A count-in is owed separately from a reveal. */
    function pending(el: HTMLElement): boolean {
      return (
        el.dataset.in === undefined ||
        (el.dataset.count !== undefined && !el.dataset.counted)
      );
    }

    function collect(root: Document | HTMLElement): HTMLElement[] {
      const out: HTMLElement[] = [];
      if (root instanceof HTMLElement && root.matches(SELECTOR)) out.push(root);
      for (const el of root.querySelectorAll<HTMLElement>(SELECTOR)) out.push(el);
      return out.filter(pending);
    }

    /** Finished state, no animation. The transition is switched off inline
     *  as well: a hidden tab freezes CSS transition clocks, so stamping the
     *  end state alone would leave the element parked at opacity 0 until
     *  the tab is next shown. */
    function settle(el: HTMLElement) {
      el.style.transition = 'none';
      el.dataset.in = '';
      if (el.dataset.count !== undefined && !el.dataset.counted) {
        el.textContent = finalCount(el);
        el.dataset.counted = '1';
      }
    }

    function runCount(el: HTMLElement) {
      el.dataset.counted = '1';
      const target = Number(el.dataset.count ?? '0');
      const suffix = el.dataset.suffix ?? '';
      const t0 = performance.now();
      const dur = 900;
      function frame(now: number) {
        const t = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = `${Math.round(target * eased)}${suffix}`;
        if (t < 1) requestAnimationFrame(frame);
        else el.textContent = finalCount(el);
      }
      requestAnimationFrame(frame);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const el = en.target as HTMLElement;
          el.dataset.in = '';
          if (el.dataset.count !== undefined && !el.dataset.counted) runCount(el);
          io.unobserve(el);
        }
      },
      // threshold 0 + bottom margin so tall or fast-scrolled elements
      // always fire (the site learned this the hard way).
      { threshold: 0, rootMargin: '0px 0px -60px 0px' },
    );

    // Activated this mount — a node can surface in both the initial scan and a
    // mutation record before its entrance has been stamped.
    const handled = new WeakSet<HTMLElement>();
    const attempts = new WeakMap<HTMLElement, number>();
    const hydrated = (el: HTMLElement) => Object.keys(el).some((k) => k.startsWith('__reactFiber'));

    function activate(input: HTMLElement[]) {
      const candidates = input.filter((el) => !handled.has(el));
      if (!candidates.length) return;

      // Streamed markup reaches the MutationObserver BEFORE React hydrates
      // it, and React 19 reports any attribute the DOM carries that its
      // props don't — so stamping now would log a hydration mismatch on
      // every page. A hydrated node owns a React fiber key; a not-yet-
      // hydrated one doesn't. Wait for the key (setTimeout, not rAF: it must
      // still fire in a hidden tab), and give up gracefully after ~4s so a
      // node React never claims still gets its entrance.
      const els: HTMLElement[] = [];
      const waiting: HTMLElement[] = [];
      for (const el of candidates) {
        const tries = attempts.get(el) ?? 0;
        if (hydrated(el) || tries > 100) els.push(el);
        else {
          attempts.set(el, tries + 1);
          waiting.push(el);
        }
      }
      if (waiting.length) setTimeout(() => activate(waiting), 40);
      if (!els.length) return;
      for (const el of els) handled.add(el);

      // Hidden documents (background tabs) freeze CSS animation clocks —
      // entrances would hang mid-reveal and count-ins would show zeros.
      // A tool must never show wrong figures: render finished states instead.
      // Checked per batch, not once, because a batch can arrive while hidden.
      if (reduced || noIO || document.hidden) {
        for (const el of els) settle(el);
        return;
      }

      // Let CSS animate stroke-dashoffset over a normalised path length.
      // (JSX-authored .draw elements should set pathLength themselves so the
      // attribute survives React re-renders; this covers static markup.)
      for (const el of els) {
        if (!el.hasAttribute('data-draw')) continue;
        for (const s of el.querySelectorAll('.draw')) {
          if (!s.hasAttribute('pathLength')) s.setAttribute('pathLength', '1');
        }
      }

      for (const el of els) {
        if (el.dataset.count !== undefined && !el.dataset.counted) el.textContent = '0';
      }

      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          // Above the fold: fast track, but only after styles have applied.
          el.dataset.fast = '';
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              el.dataset.in = '';
              if (el.dataset.count !== undefined && !el.dataset.counted) runCount(el);
            }),
          );
        } else {
          io.observe(el);
        }
      }
    }

    activate(collect(document));

    // Streamed-in content, Suspense resolutions and client-side inserts.
    // MutationObserver already batches: one callback per microtask checkpoint
    // carrying every pending record. Do NOT defer this to requestAnimationFrame
    // — rAF does not run in a hidden tab, which is exactly the case activate()
    // needs to reach in order to settle elements to their finished state.
    // Our own count-in writes replace text nodes, not elements, so this cannot
    // feed itself.
    const mo = new MutationObserver((records) => {
      const batch: HTMLElement[] = [];
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          for (const el of collect(node)) batch.push(el);
        }
      }
      activate(batch);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
