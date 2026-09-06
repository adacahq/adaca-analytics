/**
 * Segments — the dashboard-wide filter. A segment is one condition on one
 * entity kind ("Source is google", "Page contains /blog") carried in the URL
 * (`?seg=kind:op:value`) and applied to every widget of a dashboard.
 *
 * It is served entirely from stored rollups: totals and trends come from the
 * segment kind's own single family (exact, `(other)` never involved); a
 * ranked widget is re-pointed at the pair family that stores its dimension
 * together with the segment's, or at its own family when the segment lives
 * on that family's other key (Sources + medium, Pages + title, Countries +
 * city…). A widget with no stored pair for the combination says so instead
 * of showing unfiltered numbers. Pure data + pure functions.
 */
import type { Filter, FilterOp } from '@/lib/dashboard/types';
import type { Dataset } from './catalog';
import { ENTITY_BY_KIND, isEntityKind, type EntityKind, type KeySide, type Match } from './entities';
import { PAIRS, REPORT_BY_KEY, type ReportKey } from './reports';

export interface Segment {
  kind: EntityKind;
  op: FilterOp;
  value: string;
}

const OPS: FilterOp[] = ['eq', 'neq', 'contains', 'not_contains'];
export const OP_WORDS: Record<FilterOp, string> = { eq: 'is', neq: 'is not', contains: 'contains', not_contains: 'does not contain' };

/** 'kind:op:value' → Segment, or null for anything malformed (a bad link still renders). */
export function parseSegment(raw: string | null | undefined): Segment | null {
  if (!raw) return null;
  const a = raw.indexOf(':');
  const b = a === -1 ? -1 : raw.indexOf(':', a + 1);
  if (a < 1 || b === -1) return null;
  const kind = raw.slice(0, a);
  const op = raw.slice(a + 1, b);
  const value = raw.slice(b + 1);
  if (!isEntityKind(kind) || !OPS.includes(op as FilterOp) || !value) return null;
  return { kind, op: op as FilterOp, value };
}

export function segmentParam(seg: Segment): string {
  return `${seg.kind}:${seg.op}:${seg.value}`;
}

/** "Source is google". */
export function segmentLabel(seg: Segment): string {
  return `${ENTITY_BY_KIND[seg.kind].label} ${OP_WORDS[seg.op]} ${seg.value}`;
}

/**
 * Kinds with pair families behind them: every dashboard widget whose
 * dimension is stored together with theirs follows the filter. The rest
 * filter totals and trends only.
 */
export const FULL_SEGMENT_KINDS: EntityKind[] = ['source', 'medium', 'sourceMedium', 'channel', 'campaign', 'referrer', 'page', 'landing', 'country', 'device', 'event'];

/** GA4 dimension → entity kind, for reading a family's two sides. */
const DIM_KIND: Record<string, EntityKind> = {
  pagePath: 'page',
  pageTitle: 'title',
  landingPage: 'landing',
  sessionSource: 'source',
  sessionMedium: 'medium',
  sessionSourceMedium: 'sourceMedium',
  sessionDefaultChannelGroup: 'channel',
  sessionCampaignName: 'campaign',
  sessionManualAdContent: 'utmContent',
  sessionManualTerm: 'utmTerm',
  pageReferrer: 'referrer',
  country: 'country',
  region: 'region',
  city: 'city',
  deviceCategory: 'device',
  operatingSystem: 'os',
  operatingSystemVersion: 'osVersion',
  browser: 'browser',
  language: 'language',
  screenResolution: 'screen',
  newVsReturning: 'userType',
  eventName: 'event',
  hour: 'hour',
  hostName: 'host',
};

/** The entity kind each key of a family holds (null for a flag or an empty key). */
export function familySides(key: ReportKey): [EntityKind | null, EntityKind | null] {
  const [a, b] = REPORT_BY_KEY[key].gaDimensions;
  return [a ? (DIM_KIND[a] ?? null) : null, b ? (DIM_KIND[b] ?? null) : null];
}

/** How a segment of `kind` matches a key holding `sideKind`, or null when it cannot. */
function sideMatch(sideKind: EntityKind | null, kind: EntityKind): Match | null {
  if (!sideKind) return null;
  if (sideKind === kind) return 'eq';
  if (sideKind === 'sourceMedium' && kind === 'source') return 'source';
  if (sideKind === 'sourceMedium' && kind === 'medium') return 'medium';
  return null;
}

/** A key holding `sideKind` can show `shownKind`: the same kind, or a source/medium split out of "source / medium". */
function canShow(sideKind: EntityKind | null, shownKind: EntityKind | null): boolean {
  if (!sideKind || !shownKind) return false;
  return sideKind === shownKind || (sideKind === 'sourceMedium' && (shownKind === 'source' || shownKind === 'medium'));
}

/** The SQL that reads `shownKind` out of a key holding `sideKind`. */
export function shownExpr(side: KeySide, sideKind: EntityKind | null, shownKind: EntityKind | null): string {
  if (sideKind === 'sourceMedium' && shownKind === 'source') return `CASE WHEN instr(${side}, ' / ') > 0 THEN substr(${side}, 1, instr(${side}, ' / ') - 1) ELSE ${side} END`;
  if (sideKind === 'sourceMedium' && shownKind === 'medium') return `CASE WHEN instr(${side}, ' / ') > 0 THEN substr(${side}, instr(${side}, ' / ') + 3) ELSE '(none)' END`;
  return side;
}

/** The condition a segment adds to a family, on one of its keys. */
export interface SegmentClause {
  side: KeySide;
  match: Match;
  op: FilterOp;
  value: string;
}

/** A dataset resolved to the family and columns that answer it, with or without a segment. */
export interface Scope {
  report: ReportKey;
  /** Which key carries the shown dimension ('none' for site-wide totals). */
  dim: KeySide | 'none';
  /** SQL for the shown dimension ('' when none) — a key, or a split out of "source / medium". */
  dimExpr: string;
  /** The sub-dimension column, when the dataset shows one and the family still carries it. */
  sub: KeySide | null;
  segment: SegmentClause | null;
  /** Restrict to key events (through the `event` family's flag) on this key. */
  keyEventsOn: KeySide | null;
  /** The dataset's fixed condition, when it still applies. */
  where: { dim: KeySide; value: string } | null;
  /** Widget filters, mapped to the resolved family's keys. */
  filters: Filter[];
  /** The family changed away from `event`, so "Events" of a key-event dataset means key events. */
  eventCountAsKeyEvents: boolean;
}

export type ScopeResult = { ok: true; scope: Scope } | { ok: false; reason: string };

export const UNFILTERED = 'Not available for this filter';

function plain(ds: Dataset, filters: Filter[]): Scope {
  return {
    report: ds.report as ReportKey,
    dim: ds.dim,
    dimExpr: ds.dim === 'none' ? '' : ds.dim,
    sub: ds.subDim ?? null,
    segment: null,
    keyEventsOn: null,
    where: ds.where ?? null,
    filters,
    eventCountAsKeyEvents: false,
  };
}

/** The totals scope of a segment: its kind's own single family, filtered on its key. */
export function segmentScope(seg: Segment): Scope {
  const e = ENTITY_BY_KIND[seg.kind];
  return {
    report: e.family,
    dim: 'none',
    dimExpr: '',
    sub: null,
    segment: { side: e.side, match: e.match, op: seg.op, value: seg.value },
    keyEventsOn: null,
    where: null,
    filters: [],
    eventCountAsKeyEvents: false,
  };
}

/**
 * Where a dataset reads from under a segment. Realtime datasets are not
 * filtered (the caller says so on the card); everything else resolves to a
 * stored family or explains why it cannot.
 */
export function scopeFor(ds: Dataset, seg: Segment | null, filters: Filter[] = []): ScopeResult {
  const live = (filters ?? []).filter((f) => f.value);
  if (!seg) return { ok: true, scope: plain(ds, live) };
  if (ds.live) return { ok: false, reason: 'Realtime is not filtered' };
  if (ds.dim === 'none') return { ok: true, scope: { ...segmentScope(seg), where: null } };

  const family = ds.report as ReportKey;
  const [k1, k2] = familySides(family);
  const shown: KeySide = ds.dim;
  const other: KeySide = shown === 'key1' ? 'key2' : 'key1';
  const shownKind: EntityKind | null = ds.drill ?? (shown === 'key1' ? k1 : k2);
  const otherKind = shown === 'key1' ? k2 : k1;
  const base = plain(ds, live);

  // The combined "source / medium" of the `source` family (source in key1, medium in key2).
  if (family === 'source' && seg.kind === 'sourceMedium') {
    return { ok: true, scope: { ...base, segment: { side: 'key1', match: 'sourceMedium', op: seg.op, value: seg.value } } };
  }
  // The segment lives on the family's other key: Sources + medium, Pages + title, Countries + city, Pages by source + source…
  const onOther = sideMatch(otherKind, seg.kind);
  if (onOther) return { ok: true, scope: { ...base, segment: { side: other, match: onOther, op: seg.op, value: seg.value } } };
  // The segment is the shown dimension itself: the list narrows to the matching values.
  const onShown = sideMatch(shownKind, seg.kind) ?? sideMatch(shown === 'key1' ? k1 : k2, seg.kind);
  if (onShown) return { ok: true, scope: { ...base, segment: { side: shown, match: onShown, op: seg.op, value: seg.value } } };

  if (REPORT_BY_KEY[family].pair) return { ok: false, reason: 'This widget already combines two dimensions; a third is not stored' };
  if (live.some((f) => f.dim !== shown)) return { ok: false, reason: 'This widget filters on its other dimension' };

  // A pair family that stores the shown dimension together with the segment's.
  for (const p of PAIRS) {
    const [p1, p2] = familySides(p.key);
    const viaKey1 = sideMatch(p1, seg.kind);
    if (viaKey1 && canShow(p2, shownKind)) return { ok: true, scope: rerouted(ds, seg, live, p.key, 'key2', p2, shownKind, { side: 'key1', match: viaKey1 }) };
    const viaKey2 = sideMatch(p2, seg.kind);
    if (viaKey2 && canShow(p1, shownKind)) return { ok: true, scope: rerouted(ds, seg, live, p.key, 'key1', p1, shownKind, { side: 'key2', match: viaKey2 }) };
  }
  return { ok: false, reason: `${ENTITY_BY_KIND[seg.kind].label} is not stored together with ${ds.dimLabel.toLowerCase()}` };
}

function rerouted(
  ds: Dataset,
  seg: Segment,
  filters: Filter[],
  report: ReportKey,
  dim: KeySide,
  dimKind: EntityKind | null,
  shownKind: EntityKind | null,
  on: { side: KeySide; match: Match },
): Scope {
  const keyEvents = !!ds.where && ds.report === 'event';
  return {
    report,
    dim,
    dimExpr: shownExpr(dim, dimKind, shownKind),
    sub: null,
    segment: { side: on.side, match: on.match, op: seg.op, value: seg.value },
    keyEventsOn: keyEvents ? dim : null,
    where: null,
    filters: filters.map((f) => ({ ...f, dim })),
    eventCountAsKeyEvents: keyEvents,
  };
}

/** The GA4 Data API filter equivalent of a segment, for the exact-uniques lookup; null when GA has no such dimension. */
export function gaFilterFor(seg: Segment): { fieldName: string; matchType: 'EXACT' | 'CONTAINS'; value: string; not?: boolean } | null {
  const entry = Object.entries(DIM_KIND).find(([, kind]) => kind === seg.kind);
  if (!entry) return null;
  const fieldName = entry[0];
  const contains = seg.op === 'contains' || seg.op === 'not_contains' || seg.kind === 'referrer';
  return { fieldName, matchType: contains ? 'CONTAINS' : 'EXACT', value: seg.value, not: seg.op === 'neq' || seg.op === 'not_contains' };
}
