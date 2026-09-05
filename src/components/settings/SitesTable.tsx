'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { useConfirm } from '@/components/ui/Confirm';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { deleteSiteAction, updateSiteAction } from '@/lib/setup/actions';
import { fmtDay } from '@/lib/format';
import type { Site } from '@/lib/db/sites';

type Row = Site & { rows: number; span: { from: string | null; to: string | null } };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

export default function SitesTable({ sites }: { sites: Row[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ name: '', timezone: '', backfill_days: '90', bq_project_id: '', bq_dataset: '', bq_key_events: '' });
  const [pending, startTransition] = useTransition();

  function openEdit(s: Row) {
    setEditing(s);
    setForm({
      name: s.name,
      timezone: s.timezone,
      backfill_days: String(s.backfill_days),
      bq_project_id: s.bq_project_id ?? '',
      bq_dataset: s.bq_dataset ?? '',
      bq_key_events: s.bq_key_events ?? '',
    });
  }

  function save() {
    if (!editing) return;
    startTransition(async () => {
      const r = await updateSiteAction(editing.id, {
        name: form.name.trim() || editing.name,
        timezone: form.timezone.trim() || editing.timezone,
        backfill_days: Math.max(1, Number(form.backfill_days) || 90),
        bq_project_id: form.bq_project_id.trim() || null,
        bq_dataset: form.bq_dataset.trim() || null,
        bq_key_events: form.bq_key_events.trim() || null,
        primary_source: form.bq_dataset.trim() ? 'bigquery' : editing.ga_property_id ? 'ga4' : 'bigquery',
      });
      if (r.ok) {
        toast.success('Site saved');
        setEditing(null);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  async function remove(s: Row) {
    const ok = await confirm({
      title: `Remove ${s.name}?`,
      body: `Its ${s.rows.toLocaleString()} rollup rows and run history are deleted. The Google property is untouched.`,
      confirmLabel: 'Remove site',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteSiteAction(s.id);
      if (r.ok) {
        toast.success('Site removed');
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const cols: Column<Row>[] = [
    { key: 'name', header: 'Site', cell: (s) => <span style={{ fontWeight: 500 }}>{s.name}</span>, sortValue: (s) => s.name },
    {
      key: 'source',
      header: 'Source',
      cell: (s) => (
        <span className="pill">{s.primary_source === 'bigquery' ? 'BigQuery' : 'GA4 API'}</span>
      ),
    },
    { key: 'property', header: 'Property', mono: true, cell: (s) => s.ga_property_id ?? '—' },
    { key: 'tz', header: 'Timezone', mono: true, cell: (s) => s.timezone },
    {
      key: 'data',
      header: 'Data',
      mono: true,
      cell: (s) => (s.span.from ? `${fmtDay(s.span.from)} → ${fmtDay(s.span.to!)}` : 'none yet'),
    },
    { key: 'rows', header: 'Rows', align: 'right', mono: true, cell: (s) => s.rows.toLocaleString(), sortValue: (s) => s.rows },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <span className="flex justify-end gap-3">
          <button type="button" className="muted-link" onClick={() => openEdit(s)}>
            Edit
          </button>
          <button type="button" className="muted-link" onClick={() => remove(s)}>
            Remove
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={cols} rows={sites} getRowKey={(s) => s.id} empty="No sites yet." />
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : 'Edit site'}
        maxWidth={560}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={save}>
              Save
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Timezone">
            <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </Field>
          <Field label="Default backfill (days)">
            <input type="number" min={1} value={form.backfill_days} onChange={(e) => setForm({ ...form, backfill_days: e.target.value })} style={{ maxWidth: 140 }} />
          </Field>
          <p className="field-label" style={{ marginTop: 8 }}>
            BigQuery (optional)
          </p>
          <Field label="Jobs project">
            <input value={form.bq_project_id} onChange={(e) => setForm({ ...form, bq_project_id: e.target.value })} placeholder="my-gcp-project" />
          </Field>
          <Field label="Dataset">
            <input value={form.bq_dataset} onChange={(e) => setForm({ ...form, bq_dataset: e.target.value })} placeholder="analytics_123456789" />
          </Field>
          {editing && !editing.ga_property_id ? (
            <Field label="Key events">
              <input value={form.bq_key_events} onChange={(e) => setForm({ ...form, bq_key_events: e.target.value })} placeholder="purchase" />
            </Field>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
