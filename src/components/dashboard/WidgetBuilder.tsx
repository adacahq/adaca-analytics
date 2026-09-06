'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { CATEGORIES, DATASET_BY_KEY, datasetsIn, type CategoryKey, type Dataset, keyLabelsFor } from '@/lib/analytics/catalog';
import { METRIC_BY_KEY, isMetricKey, type MetricKey } from '@/lib/analytics/metrics';
import { REPORT_BY_KEY } from '@/lib/analytics/reports';
import { WIDGETS, WIDGET_BY_TYPE } from '@/lib/dashboard/widgets';
import type { ChartType, Filter, FilterOp, WidgetConfig, WidgetInstance } from '@/lib/dashboard/types';

export interface WidgetDraft {
  type: ChartType;
  title?: string;
  config: WidgetConfig;
}

const STEPS = ['Data type', 'Specific data', 'Chart type', 'Configure'];
const OPS: { value: FilterOp; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'eq', label: 'is' },
  { value: 'neq', label: 'is not' },
];

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

function Steps({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  return (
    <div className="wsteps" style={{ margin: '0 0 18px' }}>
      {STEPS.map((s, i) => (
        <span key={s} className="contents">
          {i > 0 && <span className="wl" />}
          <div className={`ws${i === current ? ' on' : i < current ? ' done' : ''}`}>
            <button type="button" onClick={() => i < current && onJump(i)} style={{ background: 'none', border: 0, padding: 0, cursor: i < current ? 'pointer' : 'default' }}>
              <span>
                <b>{i + 1}</b>
                <i> · {s}</i>
              </span>
            </button>
          </div>
        </span>
      ))}
    </div>
  );
}

function PickGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function Pick({ title, description, on, onClick, disabled }: { title: string; description: string; on?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`card pick${on ? ' on' : ''}`} onClick={onClick} disabled={disabled}>
      <h3>{title}</h3>
      <p className="text-[12.5px] mt-1.5" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        {description}
      </p>
    </button>
  );
}

function defaultsFor(ds: Dataset, type: ChartType, keep: WidgetConfig): WidgetConfig {
  const base: WidgetConfig = { dataset: ds.key, metric: keep.metric && ds.metrics.includes(keep.metric as MetricKey) ? keep.metric : ds.defaultMetric, filters: keep.filters ?? [] };
  switch (type) {
    case 'kpi':
      return { ...base, compare: keep.compare ?? true };
    case 'line':
      return { ...base, compare: keep.compare ?? false, bucket: keep.bucket };
    case 'table':
      return { ...base, metrics: keep.metrics?.length ? keep.metrics : [ds.defaultMetric, ...ds.metrics.filter((m) => m !== ds.defaultMetric).slice(0, 3)], limit: keep.limit ?? 25 };
    case 'donut':
      return { ...base, limit: keep.limit ?? 6 };
    case 'list':
    case 'bar':
    case 'column':
      return { ...base, limit: keep.limit ?? 10, showAs: keep.showAs };
    default:
      return base;
  }
}

/**
 * The add/edit widget wizard, four steps as specified:
 *   ① data type (category) → ② specific data (dataset) → ③ chart type → ④ configure.
 * Editing an existing widget opens at ④; "Change data" walks back to ①.
 */
export default function WidgetBuilder({
  open,
  onClose,
  initial,
  onSubmit,
  hasRealtime,
}: {
  open: boolean;
  onClose: () => void;
  initial: WidgetInstance | null;
  onSubmit: (draft: WidgetDraft) => void;
  hasRealtime: boolean;
}) {
  const editing = !!initial;
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [dataset, setDataset] = useState<string | null>(null);
  const [type, setType] = useState<ChartType | null>(null);
  const [title, setTitle] = useState('');
  const [config, setConfig] = useState<WidgetConfig>({});

  // Re-seed on every open (React "adjust state when a prop changes", guarded).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const ds = initial?.config.dataset ? DATASET_BY_KEY[initial.config.dataset] : undefined;
      setStep(initial ? 3 : 0);
      setCategory(ds?.category ?? null);
      setDataset(ds?.key ?? null);
      setType(initial?.type ?? null);
      setTitle(initial?.title ?? '');
      setConfig(initial?.config ?? {});
    }
  }

  const ds = dataset ? DATASET_BY_KEY[dataset] : undefined;
  const report = ds && !ds.live ? REPORT_BY_KEY[ds.report as keyof typeof REPORT_BY_KEY] : undefined;
  const keyLabels = ds ? keyLabelsFor(ds, report?.keyLabels ?? []) : [];

  function patch(p: Partial<WidgetConfig>) {
    setConfig((c) => ({ ...c, ...p }));
  }

  function pickCategory(k: CategoryKey) {
    setCategory(k);
    setStep(1);
  }
  function pickDataset(d: Dataset) {
    setDataset(d.key);
    if (type && !d.charts.includes(type)) setType(null);
    setStep(2);
  }
  function pickType(t: ChartType) {
    setType(t);
    if (t === 'note') {
      setConfig({ markdown: config.markdown ?? '' });
    } else if (ds) {
      setConfig(defaultsFor(ds, t, config));
    }
    setStep(3);
  }
  function pickNote() {
    setType('note');
    setDataset(null);
    setConfig({ markdown: config.markdown ?? '' });
    setStep(3);
  }

  function canSubmit(): boolean {
    if (!type) return false;
    if (type === 'note') return true;
    if (!ds) return false;
    if (type === 'table') return (config.metrics?.length ?? 0) > 0;
    return isMetricKey(config.metric) && ds.metrics.includes(config.metric);
  }

  function submit() {
    if (!type || !canSubmit()) return;
    onSubmit({ type, title: title.trim() || undefined, config });
    onClose();
  }

  function setFilter(i: number, f: Partial<Filter> | null) {
    setConfig((c) => {
      const list = [...(c.filters ?? [])];
      if (f === null) list.splice(i, 1);
      else {
        const cur: Filter = list[i] ?? { dim: 'key1', op: 'contains', value: '' };
        list[i] = { ...cur, ...f };
      }
      return { ...c, filters: list };
    });
  }

  const metricOptions = (ds?.metrics ?? []).map((m) => ({ value: m, label: METRIC_BY_KEY[m].label }));
  const chartMeta = type ? WIDGET_BY_TYPE[type] : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit widget' : 'Add widget'}
      maxWidth={720}
      footer={
        <div className="flex items-center gap-3" style={{ width: '100%' }}>
          {step > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(editing && step === 3 ? 0 : step - 1)}>
              {editing && step === 3 ? 'Change data' : 'Back'}
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          {step === 3 && (
            <button type="button" className="btn btn-primary btn-sm" disabled={!canSubmit()} onClick={submit}>
              {editing ? 'Save' : 'Add to dashboard'}
            </button>
          )}
        </div>
      }
    >
      <Steps current={step} onJump={setStep} />

      {step === 0 && (
        <>
          <p className="text-[13px] mb-4" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            What kind of data should this widget show?
          </p>
          <PickGrid>
            {CATEGORIES.map((c) => (
              <Pick
                key={c.key}
                title={c.label}
                description={c.key === 'realtime' && !hasRealtime ? 'Needs a GA4 property — this site reads a BigQuery export only.' : c.description}
                on={category === c.key}
                disabled={c.key === 'realtime' && !hasRealtime}
                onClick={() => pickCategory(c.key)}
              />
            ))}
            <Pick title="Note" description="Free text in Markdown — a heading, a caveat, a link. No data." on={type === 'note'} onClick={pickNote} />
          </PickGrid>
        </>
      )}

      {step === 1 && category && (
        <>
          <p className="text-[13px] mb-4" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            {CATEGORIES.find((c) => c.key === category)?.label}: pick the specific data.
          </p>
          <PickGrid>
            {datasetsIn(category).map((d) => (
              <Pick key={d.key} title={d.label} description={d.description} on={dataset === d.key} onClick={() => pickDataset(d)} />
            ))}
          </PickGrid>
        </>
      )}

      {step === 2 && ds && (
        <>
          <p className="text-[13px] mb-4" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            How should <b style={{ color: 'var(--fg)' }}>{ds.label}</b> be presented?
          </p>
          <PickGrid>
            {WIDGETS.filter((w) => ds.charts.includes(w.type)).map((w) => (
              <Pick key={w.type} title={w.title} description={w.description} on={type === w.type} onClick={() => pickType(w.type)} />
            ))}
          </PickGrid>
        </>
      )}

      {step === 3 && type && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2 flex-wrap">
            {ds ? <span className="pill">{CATEGORIES.find((c) => c.key === ds.category)?.label}</span> : null}
            {ds ? <span className="pill doing">{ds.label}</span> : null}
            <span className="pill">{chartMeta?.title}</span>
          </div>
          <FieldRow label="Title" hint="Optional — shown in the card header.">
            <input placeholder={ds ? `${ds.label}` : chartMeta?.title} value={title} onChange={(e) => setTitle(e.target.value)} />
          </FieldRow>

          {type === 'note' && (
            <FieldRow label="Content" hint="Markdown: headings, lists, links, tables.">
              <textarea value={config.markdown ?? ''} onChange={(e) => patch({ markdown: e.target.value })} rows={8} />
            </FieldRow>
          )}

          {ds && type !== 'note' && type !== 'table' && (
            <FieldRow label="Metric">
              <Select fullWidth value={config.metric ?? ds.defaultMetric} onChange={(v) => patch({ metric: v })} options={metricOptions} ariaLabel="Metric" />
            </FieldRow>
          )}

          {ds && type === 'table' && (
            <FieldRow label="Columns" hint="The dimension column is always first.">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {ds.metrics.map((m) => (
                  <label key={m} className="check">
                    <input
                      type="checkbox"
                      checked={(config.metrics ?? []).includes(m)}
                      onChange={() =>
                        patch({ metrics: (config.metrics ?? []).includes(m) ? (config.metrics ?? []).filter((x) => x !== m) : [...(config.metrics ?? []), m] })
                      }
                    />
                    {METRIC_BY_KEY[m].label}
                  </label>
                ))}
              </div>
            </FieldRow>
          )}

          {ds && ds.dim !== 'none' && !ds.live && (type === 'list' || type === 'bar' || type === 'column' || type === 'donut' || type === 'table') && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FieldRow label="Rows">
                <input type="number" min={1} max={type === 'table' ? 500 : 50} value={config.limit ?? 10} onChange={(e) => patch({ limit: Math.max(1, Number(e.target.value) || 10) })} />
              </FieldRow>
              <FieldRow label="Sort by">
                <Select
                  fullWidth
                  value={config.sort?.metric ?? ''}
                  onChange={(v) => patch({ sort: v ? { metric: v, dir: config.sort?.dir ?? 'desc' } : undefined })}
                  options={[{ value: '', label: 'Metric shown' }, ...(type === 'table' ? (config.metrics ?? []).filter(isMetricKey) : ds.metrics).map((m) => ({ value: m, label: METRIC_BY_KEY[m].label }))]}
                  ariaLabel="Sort by"
                />
              </FieldRow>
              <FieldRow label="Order">
                <Select
                  fullWidth
                  value={config.sort?.dir ?? 'desc'}
                  onChange={(v) => patch({ sort: { metric: config.sort?.metric ?? config.metric ?? ds.defaultMetric, dir: v as 'asc' | 'desc' } })}
                  options={[
                    { value: 'desc', label: 'Highest first' },
                    { value: 'asc', label: 'Lowest first' },
                  ]}
                  ariaLabel="Order"
                />
              </FieldRow>
            </div>
          )}

          {ds && ds.live && (type === 'list' || type === 'bar' || type === 'table') && (
            <FieldRow label="Rows">
              <input type="number" min={1} max={50} value={config.limit ?? 10} onChange={(e) => patch({ limit: Math.max(1, Number(e.target.value) || 10) })} style={{ maxWidth: 140 }} />
            </FieldRow>
          )}

          {ds && (type === 'list' || type === 'bar') && !ds.live && (
            <FieldRow label="Show as">
              <div className="seg">
                <button type="button" className={(config.showAs ?? 'value') === 'value' ? 'on' : undefined} onClick={() => patch({ showAs: 'value' })}>
                  Value
                </button>
                <button type="button" className={config.showAs === 'percent' ? 'on' : undefined} onClick={() => patch({ showAs: 'percent' })}>
                  Share of total
                </button>
              </div>
            </FieldRow>
          )}

          {ds && !ds.live && (type === 'line' || (type === 'column' && ds.dim === 'none' && ds.key !== 'behaviour.weekdays') || (type === 'table' && ds.dim === 'none')) && (
            <FieldRow label="Group by">
              <Select
                value={config.bucket ?? ''}
                onChange={(v) => patch({ bucket: (v || undefined) as WidgetConfig['bucket'] })}
                options={[
                  { value: '', label: 'Automatic' },
                  ...(ds.report === 'totals' ? [{ value: 'hour', label: 'Hour (a day or two of site totals)' }] : []),
                  { value: 'day', label: 'Day' },
                  { value: 'week', label: 'Week' },
                  { value: 'month', label: 'Month' },
                ]}
                ariaLabel="Group by"
              />
            </FieldRow>
          )}

          {ds && !ds.live && (type === 'kpi' || type === 'line' || (type === 'column' && ds.dim === 'none')) && (
            <label className="check">
              <input type="checkbox" checked={config.compare ?? type === 'kpi'} onChange={(e) => patch({ compare: e.target.checked })} />
              Compare with the previous period
            </label>
          )}

          {ds && !ds.live && keyLabels.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="field-label" style={{ margin: 0 }}>
                Filters
              </span>
              {(config.filters ?? []).map((f, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  {keyLabels.length > 1 ? (
                    <Select value={f.dim} onChange={(v) => setFilter(i, { dim: v as 'key1' | 'key2' })} options={keyLabels.map((l, j) => ({ value: j === 0 ? 'key1' : 'key2', label: l }))} ariaLabel="Filter field" />
                  ) : (
                    <span className="pill">{keyLabels[0]}</span>
                  )}
                  <Select value={f.op} onChange={(v) => setFilter(i, { op: v as FilterOp })} options={OPS} ariaLabel="Filter operator" />
                  <div className="field" style={{ flex: 1, minWidth: 140 }}>
                    <input value={f.value} placeholder="value" onChange={(e) => setFilter(i, { value: e.target.value })} />
                  </div>
                  <button type="button" className="muted-link" onClick={() => setFilter(i, null)} aria-label="Remove filter">
                    ✕
                  </button>
                </div>
              ))}
              <div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilter((config.filters ?? []).length, { dim: 'key1', op: 'contains', value: '' })}>
                  + Add filter
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
