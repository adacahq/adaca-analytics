'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Select from '@/components/ui/Select';
import { ENTITIES, ENTITY_BY_KIND, type EntityKind } from '@/lib/analytics/entities';
import { FULL_SEGMENT_KINDS, OP_WORDS, parseSegment, segmentLabel, segmentParam, type Segment } from '@/lib/analytics/segments';
import { deleteSegmentAction, saveSegmentAction, segmentValues } from '@/lib/analytics/segment-actions';
import type { FilterOp } from '@/lib/dashboard/types';
import { Chevron, usePanel } from './usePanel';

export interface SavedSegmentOption {
  id: string;
  name: string;
  kind: EntityKind;
  op: FilterOp;
  value: string;
}

const OPS: FilterOp[] = ['eq', 'neq', 'contains', 'not_contains'];

const KIND_OPTIONS = [
  ...FULL_SEGMENT_KINDS.map((k) => ({ value: k, label: ENTITY_BY_KIND[k].label })),
  ...ENTITIES.filter((e) => !FULL_SEGMENT_KINDS.includes(e.kind)).map((e, i) => ({ value: e.kind, label: `${e.label} (totals and trend only)`, dividerBefore: i === 0 })),
];

/**
 * The dashboard-wide filter: one condition on one dimension, carried in the
 * URL as `?seg=kind:op:value` so links keep it, applied to every widget that
 * has the pair stored (the rest say so). Saved segments are shared, like
 * dashboards.
 */
export default function SegmentControl({ siteId, saved, pathname }: { siteId: string; saved: SavedSegmentOption[]; pathname: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname() ?? pathname;
  const { ref, open, toggle, close } = usePanel<HTMLDivElement>(pathname);
  const current = parseSegment(params?.get('seg'));
  const [draft, setDraft] = useState<Segment>(current ?? { kind: 'source', op: 'eq', value: '' });
  const [values, setValues] = useState<string[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();

  // Suggestions for the chosen kind, from the site's own rollups over the current period.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const period = { range: params?.get('range'), from: params?.get('from'), to: params?.get('to') };
    segmentValues(siteId, draft.kind, period).then((v) => {
      if (alive) setValues(v);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft.kind, siteId]);

  function push(seg: Segment | null) {
    const keep = new URLSearchParams(params?.toString());
    if (seg) keep.set('seg', segmentParam(seg));
    else keep.delete('seg');
    const qs = keep.toString();
    router.push(qs ? `${path}?${qs}` : path);
    close();
  }
  function apply() {
    const value = draft.value.trim();
    if (!value) return;
    push({ ...draft, value });
  }
  function save() {
    startTransition(async () => {
      const r = await saveSegmentAction(name, { ...draft, value: draft.value.trim() });
      if (r.ok) {
        toast.success('Segment saved');
        setNaming(false);
        setName('');
        router.refresh();
      } else toast.error(r.error);
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteSegmentAction(id);
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
  }

  const listId = 'seg-values';

  return (
    <div className="tbdrop" ref={ref}>
      <button type="button" className={current ? 'tbbtn filter on' : 'tbbtn filter'} onClick={toggle} aria-expanded={open} aria-haspopup="dialog">
        <span className="tbsect">Filter</span>
        <b title={current ? segmentLabel(current) : undefined}>{current ? segmentLabel(current) : 'None'}</b>
        <Chevron />
      </button>
      {current ? (
        <button type="button" className="tbx" onClick={() => push(null)} aria-label="Clear the filter" title="Clear the filter">
          ✕
        </button>
      ) : null}
      {open ? (
        <div className="tbpanel range center filter" role="dialog" aria-label="Filter the dashboard">
          {saved.length > 0 ? (
            <>
              <span className="plabel">Saved segments</span>
              <div className="srows">
                {saved.map((s) => {
                  const on = current && current.kind === s.kind && current.op === s.op && current.value === s.value;
                  return (
                    <div key={s.id} className={on ? 'srow on' : 'srow'}>
                      <button type="button" className="tbrow" onClick={() => push({ kind: s.kind, op: s.op, value: s.value })}>
                        <span className="truncate">{s.name}</span>
                        <small className="truncate">{segmentLabel(s)}</small>
                      </button>
                      <button type="button" className="muted-link" onClick={() => remove(s.id)} aria-label={`Delete ${s.name}`} disabled={pending}>
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
          <span className="plabel">Filter by</span>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={draft.kind} onChange={(v) => setDraft((d) => ({ ...d, kind: v as EntityKind, value: '' }))} options={KIND_OPTIONS} ariaLabel="Dimension" />
            <Select value={draft.op} onChange={(v) => setDraft((d) => ({ ...d, op: v as FilterOp }))} options={OPS.map((o) => ({ value: o, label: OP_WORDS[o] }))} ariaLabel="Operator" />
          </div>
          <div className="field">
            <input
              list={listId}
              value={draft.value}
              placeholder={`${ENTITY_BY_KIND[draft.kind].label} value`}
              onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') apply();
              }}
              aria-label="Value"
            />
            <datalist id={listId}>
              {values.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={!draft.value.trim()} onClick={apply}>
              Apply
            </button>
            {naming ? (
              <>
                <div className="field" style={{ flex: 1, minWidth: 120 }}>
                  <input
                    value={name}
                    placeholder="Segment name"
                    autoFocus
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && name.trim()) save();
                    }}
                    aria-label="Segment name"
                  />
                </div>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!name.trim() || !draft.value.trim() || pending} onClick={save}>
                  Save
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" disabled={!draft.value.trim()} onClick={() => setNaming(true)}>
                Save as segment
              </button>
            )}
            <span style={{ flex: 1 }} />
            {current ? (
              <button type="button" className="muted-link" onClick={() => push(null)}>
                Clear
              </button>
            ) : null}
          </div>
          <p className="micro" style={{ padding: '0 4px', lineHeight: 1.5 }}>
            Widgets whose data is stored together with this dimension follow the filter; the rest say so. Realtime is never filtered.
          </p>
        </div>
      ) : null}
    </div>
  );
}
