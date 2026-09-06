'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { useConfirm } from '@/components/ui/Confirm';
import { createShareAction, listSharesAction, revokeShareAction, type ShareRow } from '@/lib/dashboard/share-actions';
import { parseSegment, segmentLabel } from '@/lib/analytics/segments';
import { PRESETS } from '@/lib/analytics/ranges';
import { fmtDay } from '@/lib/format';
import type { Dashboard } from '@/lib/dashboard/types';

function describeLock(lock: ShareRow['lock']): string {
  if (!lock) return 'period chosen by the reader';
  if (lock.from && lock.to) return `${fmtDay(lock.from)} to ${fmtDay(lock.to)}`;
  return PRESETS.find((p) => p.key === lock.range)?.label ?? 'Last 28 days';
}

/**
 * Share links for a dashboard: the active ones with copy / embed / revoke,
 * and a form for a new one that can lock the current period and pin the
 * current filter, so a slice can be shared without the rest.
 */
export default function ShareModal({ open, onClose, dashboard }: { open: boolean; onClose: () => void; dashboard: Dashboard }) {
  const params = useSearchParams();
  const confirm = useConfirm();
  const [rows, setRows] = useState<ShareRow[] | null>(null);
  const [name, setName] = useState('');
  const [lockPeriod, setLockPeriod] = useState(false);
  const [pinFilter, setPinFilter] = useState(true);
  const [embedFor, setEmbedFor] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const seg = parseSegment(params?.get('seg'));
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listSharesAction(dashboard.id).then((r) => {
      if (alive) setRows(r);
    });
    return () => {
      alive = false;
    };
  }, [open, dashboard.id]);

  // Reset on the way out (an event, not an effect) so the next open starts from "Loading".
  function close() {
    setRows(null);
    setEmbedFor(null);
    onClose();
  }

  function create() {
    startTransition(async () => {
      const lock = lockPeriod ? { range: params?.get('range'), from: params?.get('from'), to: params?.get('to'), compare: params?.get('compare') } : null;
      const r = await createShareAction(dashboard.id, { name, lockRange: lock, seg: pinFilter && seg ? params?.get('seg') ?? null : null });
      if (r.ok) {
        setRows((prev) => [r.data, ...(prev ?? [])]);
        setName('');
        toast.success('Link created');
      } else toast.error(r.error);
    });
  }
  async function revoke(row: ShareRow) {
    const ok = await confirm({ title: 'Revoke this link?', body: 'Anyone who has it loses access straight away.', confirmLabel: 'Revoke link', danger: true });
    if (!ok) return;
    startTransition(async () => {
      const r = await revokeShareAction(row.id);
      if (r.ok) setRows((prev) => (prev ?? []).filter((x) => x.id !== row.id));
      else toast.error(r.error);
    });
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy; select the link and copy it by hand');
    }
  }

  const current = params ? { range: params.get('range'), from: params.get('from'), to: params.get('to') } : null;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Share dashboard"
      maxWidth={620}
      footer={
        <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
          Close
        </button>
      }
    >
      <p className="text-[13px]" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        A link opens <b style={{ color: 'var(--fg)' }}>{dashboard.name}</b> read-only for the current site, without signing in and outside the deployment’s gate. Behind Cloudflare Access, add a bypass for <code>/share/*</code>, <code>/api/share/*</code> and <code>/_next/*</code> (see the README).
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <span className="field-label" style={{ margin: 0 }}>
          New link
        </span>
        <div className="field">
          <input value={name} placeholder="Name (optional): who it is for" onChange={(e) => setName(e.target.value)} aria-label="Link name" autoFocus />
        </div>
        <label className="check">
          <input type="checkbox" checked={lockPeriod} onChange={(e) => setLockPeriod(e.target.checked)} />
          Lock the period to the current one ({describeLock(current)})
        </label>
        {seg ? (
          <label className="check">
            <input type="checkbox" checked={pinFilter} onChange={(e) => setPinFilter(e.target.checked)} />
            Pin the filter: {segmentLabel(seg)}
          </label>
        ) : null}
        <div>
          <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={create}>
            Create link
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <span className="field-label" style={{ margin: 0 }}>
          Active links
        </span>
        {rows === null ? (
          <p className="micro">Loading</p>
        ) : rows.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
            None yet.
          </p>
        ) : (
          rows.map((r) => {
            const url = `${origin}/share/${r.token}`;
            return (
              <div key={r.id} className="card sharerow">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span style={{ fontWeight: 500 }}>{r.name || 'Untitled link'}</span>
                  <span className="micro">
                    {describeLock(r.lock)}
                    {r.seg ? ` · ${segmentLabel(parseSegment(r.seg)!)}` : ''}
                  </span>
                </div>
                <div className="field mt-2">
                  <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
                </div>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <button type="button" className="muted-link" onClick={() => copy(url)}>
                    Copy link
                  </button>
                  <button type="button" className="muted-link" onClick={() => setEmbedFor(embedFor === r.id ? null : r.id)}>
                    {embedFor === r.id ? 'Hide embed' : 'Embed'}
                  </button>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="muted-link" style={{ color: 'var(--crit)' }} disabled={pending} onClick={() => revoke(r)}>
                    Revoke
                  </button>
                </div>
                {embedFor === r.id ? (
                  <div className="field mt-2">
                    <textarea readOnly rows={2} value={`<iframe src="${url}?embed=1" width="100%" height="900" style="border:0" loading="lazy"></iframe>`} onFocus={(e) => e.currentTarget.select()} aria-label="Embed code" />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
