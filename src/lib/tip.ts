/**
 * The instrument-readout tooltip's data contract. Server components serialise
 * a TipData into a `data-tip` attribute with tip(); the VizTip layer (mounted
 * once in the root layout) parses it on hover/focus and renders the plate.
 * Client charts (MiniChart, Spark, Gantt) drive the same plate directly
 * through the 'red:tip' custom event instead.
 */

/** Colour tokens a tooltip row may key itself with — a closed set, because
 *  the value lands in an inline style. */
export type TipTone = 'accent' | 'accent2' | 'green' | 'amber' | 'red' | 'muted' | 'fg';

export interface TipRow {
  /** The number — leads, set large. */
  v: string;
  /** The label — follows, set small. */
  l?: string;
  /** Series-key stroke colour; omit for no key. */
  tone?: TipTone;
  /** Dashed key stroke (mirrors a dashed series mark). */
  dashed?: boolean;
}

export interface TipData {
  /** Eyebrow: what point this is (a date, a cell, a person). */
  k?: string;
  rows?: TipRow[];
  /** Footnote under the rows. */
  n?: string;
}

export function tip(d: TipData): string {
  return JSON.stringify(d);
}

/** Detail for the 'red:tip' event: show at (x,y) — following the pointer
 *  unless pin — or null to hide. */
export interface TipEvent {
  data: TipData;
  x: number;
  y: number;
  /** Anchor to (x,y) instead of following the pointer (keyboard focus). */
  pin?: boolean;
}

/** Labels for a trailing n-week trend, newest last: W−11 … W−1, Now. */
export function weekLabels(n: number): string[] {
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? 'Now' : `W−${n - 1 - i}`));
}
