'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { useConfirm } from '@/components/ui/Confirm';
import { createReportAction, deleteReportAction, sendReportNowAction, setReportEnabledAction } from '@/lib/reports/actions';
import type { Report, ReportChannel, ReportKind } from '@/lib/db/reports';
import { fmtInstant, fmtInt } from '@/lib/format';

export interface SiteOption {
  id: string;
  name: string;
  hasRealtime: boolean;
}

const KIND_LABEL: Record<ReportKind, string> = { weekly: 'Weekly summary', monthly: 'Monthly summary', spike: 'Traffic spike alert', drop: 'Traffic drop alert' };
const KIND_HINT: Record<ReportKind, string> = {
  weekly: 'Every Monday after 08:00 site time: last week’s headline numbers with deltas, and the top pages, sources and countries.',
  monthly: 'On the 1st after 08:00 site time: the same for the month before.',
  spike: 'When the live visitor count reaches the threshold; at most once every 12 hours.',
  drop: 'When visits in the last 12 hours fall below the threshold; checked hourly, at most once every 12 hours.',
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? (
        <p className="mt-1.5 text-[12px]" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Settings → Reports: the scheduled summaries and alerts, with a form for a new one. */
export default function ReportsPanel({ reports, sites, emailConfigured }: { reports: Report[]; sites: SiteOption[]; emailConfigured: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ siteId: sites[0]?.id ?? '', kind: 'weekly' as ReportKind, channel: (emailConfigured ? 'email' : 'slack') as ReportChannel, target: '', threshold: '10' });
  const [pending, startTransition] = useTransition();
  const byId = new Map(sites.map((s) => [s.id, s]));
  const alert = form.kind === 'spike' || form.kind === 'drop';

  function create() {
    startTransition(async () => {
      const r = await createReportAction({ siteId: form.siteId, kind: form.kind, channel: form.channel, target: form.target, threshold: Number(form.threshold) });
      if (r.ok) {
        toast.success('Report added');
        setOpen(false);
        setForm((f) => ({ ...f, target: '' }));
        router.refresh();
      } else toast.error(r.error);
    });
  }
  function toggle(rep: Report) {
    startTransition(async () => {
      const r = await setReportEnabledAction(rep.id, rep.enabled !== 1);
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
  }
  function sendNow(rep: Report) {
    startTransition(async () => {
      const r = await sendReportNowAction(rep.id);
      if (r.ok) toast.success('Sent');
      else toast.error(r.error);
      router.refresh();
    });
  }
  async function remove(rep: Report) {
    const ok = await confirm({ title: 'Delete this report?', body: `${KIND_LABEL[rep.kind]} to ${rep.target} stops.`, confirmLabel: 'Delete report', danger: true });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteReportAction(rep.id);
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
  }

  return (
    <div>
      <div className="flex justify-end">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)} disabled={sites.length === 0}>
          + New report
        </button>
      </div>

      {!emailConfigured ? (
        <div className="alert mt-4">
          Email delivery is off until the <code>RESEND_API_KEY</code> and <code>REPORT_FROM</code> secrets are set (README → Reports). Slack webhooks work without them.
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {reports.length === 0 ? (
          <div className="empty">
            <span className="zone-label">Reports</span>
            <p>No scheduled reports or alerts yet.</p>
          </div>
        ) : (
          reports.map((rep) => (
            <div key={rep.id} className="card mcard" style={{ opacity: rep.enabled === 1 ? 1 : 0.6 }}>
              <div className="mrow">
                <span style={{ fontWeight: 500 }}>
                  {KIND_LABEL[rep.kind]} · {byId.get(rep.site_id)?.name ?? rep.site_id}
                </span>
                <span className={rep.enabled === 1 ? 'pill ok' : 'pill'}>{rep.enabled === 1 ? 'on' : 'paused'}</span>
              </div>
              <dl className="mdl">
                <dt>{rep.channel === 'email' ? 'Email' : 'Slack'}</dt>
                <dd>{rep.channel === 'email' ? rep.target : `${rep.target.slice(0, 40)}…`}</dd>
                {rep.kind === 'spike' || rep.kind === 'drop' ? (
                  <>
                    <dt>Threshold</dt>
                    <dd>{fmtInt(rep.threshold)} {rep.kind === 'spike' ? 'live visitors' : 'visits in 12 hours'}</dd>
                  </>
                ) : null}
                <dt>Last sent</dt>
                <dd>{rep.last_sent_at ? fmtInstant(rep.last_sent_at) : '–'}</dd>
                {rep.last_error ? (
                  <>
                    <dt>Error</dt>
                    <dd style={{ color: 'var(--crit)' }}>{rep.last_error}</dd>
                  </>
                ) : null}
              </dl>
              <div className="macts">
                <button type="button" className="muted-link" disabled={pending} onClick={() => sendNow(rep)}>
                  Send now
                </button>
                <button type="button" className="muted-link" disabled={pending} onClick={() => toggle(rep)}>
                  {rep.enabled === 1 ? 'Pause' : 'Resume'}
                </button>
                <button type="button" className="muted-link" disabled={pending} onClick={() => remove(rep)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New report"
        maxWidth={560}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={pending || !form.target.trim() || !form.siteId} onClick={create}>
              Add report
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <Field label="Site">
            <Select fullWidth value={form.siteId} onChange={(v) => setForm({ ...form, siteId: v })} options={sites.map((s) => ({ value: s.id, label: s.name }))} ariaLabel="Site" />
          </Field>
          <Field label="What" hint={KIND_HINT[form.kind]}>
            <Select
              fullWidth
              value={form.kind}
              onChange={(v) => setForm({ ...form, kind: v as ReportKind })}
              options={(Object.keys(KIND_LABEL) as ReportKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
              ariaLabel="Kind"
            />
          </Field>
          {alert ? (
            <Field label={form.kind === 'spike' ? 'Live visitors at or above' : 'Visits in 12 hours below'}>
              <input type="number" min={1} value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} style={{ maxWidth: 160 }} />
            </Field>
          ) : null}
          <Field label="Deliver to">
            <div className="seg" style={{ marginBottom: 10 }}>
              <button type="button" className={form.channel === 'email' ? 'on' : undefined} onClick={() => setForm({ ...form, channel: 'email' })}>
                Email
              </button>
              <button type="button" className={form.channel === 'slack' ? 'on' : undefined} onClick={() => setForm({ ...form, channel: 'slack' })}>
                Slack
              </button>
            </div>
            <input
              value={form.target}
              placeholder={form.channel === 'email' ? 'name@company.com' : 'https://hooks.slack.com/services/…'}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              aria-label={form.channel === 'email' ? 'Email address' : 'Slack webhook URL'}
            />
            {form.channel === 'email' && !emailConfigured ? (
              <p className="mt-1.5 text-[12px]" style={{ color: 'var(--crit)', lineHeight: 1.5 }}>
                Email is not set up on this deployment yet.
              </p>
            ) : null}
          </Field>
        </div>
      </Modal>
    </div>
  );
}
