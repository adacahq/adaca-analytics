'use client';

import { useState, useTransition } from 'react';
import Select from '@/components/ui/Select';
import DatePicker from '@/components/ui/DatePicker';
import { createBigQuerySite, createGa4Site, testBigQuery } from '@/lib/setup/actions';
import type { PropertySummary } from '@/lib/google/admin';
import { addDays } from '@/lib/analytics/ranges';

export interface WizardProps {
  credentials: { ok: true; email: string; project: string | null } | { ok: false; error: string };
  properties: PropertySummary[] | null;
  propertiesError: string | null;
  /** True when the wizard is reached from Settings with sites already present. */
  hasSites: boolean;
}

const STEPS = ['Credentials', 'Property', 'BigQuery', 'Backfill'];

function Steps({ current }: { current: number }) {
  return (
    <div className="wsteps">
      {STEPS.map((s, i) => (
        <span key={s} className="contents">
          {i > 0 && <span className="wl" />}
          <div className={`ws${i === current ? ' on' : i < current ? ' done' : ''}`}>
            <span>
              <b>{i + 1}</b>
              <i> · {s}</i>
            </span>
          </div>
        </span>
      ))}
    </div>
  );
}

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

export default function SetupWizard({ credentials, properties, propertiesError, hasSites }: WizardProps) {
  const [step, setStep] = useState(credentials.ok ? 1 : 0);
  const [mode, setMode] = useState<'ga4' | 'bigquery'>('ga4');
  const [propertyId, setPropertyId] = useState(properties?.[0]?.id ?? '');
  const [manualId, setManualId] = useState('');
  const [name, setName] = useState('');
  const [bqProject, setBqProject] = useState(credentials.ok ? credentials.project ?? '' : '');
  const [bqDataset, setBqDataset] = useState('');
  const [bqTest, setBqTest] = useState<{ tables: number; first: string | null; last: string | null } | null>(null);
  const [bqError, setBqError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('UTC');
  const [keyEvents, setKeyEvents] = useState('purchase');
  const [days, setDays] = useState('90');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chosenId = propertyId === '__manual' ? manualId.trim() : propertyId;
  const chosen = properties?.find((p) => p.id === propertyId);

  function runBqTest() {
    setBqError(null);
    setBqTest(null);
    startTransition(async () => {
      const r = await testBigQuery({ project: bqProject, dataset: bqDataset });
      if (r.ok) {
        setBqTest(r.data);
        if (r.data.last) {
          setTo(r.data.last);
          setFrom(r.data.first && addDays(r.data.last, -30) < r.data.first ? r.data.first : addDays(r.data.last, -30));
        }
      } else setBqError(r.error);
    });
  }

  function create() {
    setError(null);
    startTransition(async () => {
      const r =
        mode === 'ga4'
          ? await createGa4Site({
              propertyId: chosenId,
              name: name || chosen?.displayName,
              backfillDays: Number(days),
              bqProject: bqTest ? bqProject : undefined,
              bqDataset: bqTest ? bqDataset : undefined,
            })
          : await createBigQuerySite({ name, bqProject, bqDataset, timezone, keyEvents, from, to });
      // A full load, not a client navigation: the shell (site switcher, date
      // range) is rendered by the layout, which the router would otherwise
      // serve from its cache as it looked before the site existed.
      if (r.ok) window.location.assign('/');
      else setError(r.error);
    });
  }

  const canNext1 = mode === 'ga4' ? /^\d+$/.test(chosenId) : true;
  const canCreate = mode === 'ga4' ? /^\d+$/.test(chosenId) : Boolean(name.trim() && bqTest && from && to);

  return (
    <div>
      <Steps current={step} />
      <div className="card mt-6" style={{ padding: 24 }}>
        {step === 0 && (
          <div className="flex flex-col gap-5">
            {credentials.ok ? (
              <>
                <div className="alert" style={{ color: 'var(--fg)' }}>
                  <span className="rag g" style={{ marginTop: 6 }} />
                  <div>
                    Service account ready: <b className="mono">{credentials.email}</b>
                    {credentials.project ? <span className="mono-micro" style={{ display: 'block', marginTop: 4 }}>Project {credentials.project}</span> : null}
                  </div>
                </div>
                <p className="text-[13.5px]" style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
                  Give this address <b>Viewer</b> access on every GA4 property you want here, under <b>Admin</b>, then <b>Property access management</b>, in Google Analytics. For a BigQuery export, also grant it BigQuery Job User on the jobs project and BigQuery Data Viewer on the dataset.
                </p>
              </>
            ) : (
              <>
                <div className="alert error">{credentials.error}</div>
                <p className="text-[13.5px]" style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
                  Create a service account in Google Cloud, download its JSON key, and store it as the <span className="mono">GOOGLE_SERVICE_ACCOUNT_JSON</span> secret, or in <span className="mono">.dev.vars</span> locally. Then reload this page.
                </p>
              </>
            )}
            <div className="flex justify-end">
              <button type="button" className="btn btn-primary btn-sm" disabled={!credentials.ok} onClick={() => setStep(1)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="seg">
              <button type="button" className={mode === 'ga4' ? 'on' : undefined} onClick={() => setMode('ga4')}>
                GA4 property
              </button>
              <button type="button" className={mode === 'bigquery' ? 'on' : undefined} onClick={() => setMode('bigquery')}>
                BigQuery export only
              </button>
            </div>
            {mode === 'ga4' ? (
              <>
                {propertiesError ? <div className="alert error">{propertiesError}</div> : null}
                {properties && properties.length > 0 ? (
                  <Field label="Property" hint="Every property the service account can see. If one is missing, grant the account Viewer access on it and reload.">
                    <Select
                      fullWidth
                      value={propertyId}
                      onChange={setPropertyId}
                      ariaLabel="Property"
                      options={[
                        ...properties.map((p) => ({ value: p.id, label: `${p.displayName} · ${p.accountName} · ${p.id}` })),
                        { value: '__manual', label: 'Enter a property id by hand', dividerBefore: true },
                      ]}
                    />
                  </Field>
                ) : (
                  <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>
                    The service account cannot see any properties yet. Grant it Viewer access in Google Analytics, or enter a property id below.
                  </p>
                )}
                {(propertyId === '__manual' || !properties?.length) && (
                  <Field label="Property id" hint="The numeric id under Admin, then Property settings, in Google Analytics.">
                    <input value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder="351349891" inputMode="numeric" />
                  </Field>
                )}
                <Field label="Site name" hint="Optional. Defaults to the property's name.">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={chosen?.displayName ?? 'My site'} />
                </Field>
              </>
            ) : (
              <>
                <p className="text-[13.5px]" style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
                  A site read from a GA4 BigQuery export alone. It has no realtime view. Try it with Google's public sample:{' '}
                  <span className="mono">bigquery-public-data.ga4_obfuscated_sample_ecommerce</span>.
                </p>
                <Field label="Site name">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sample store" />
                </Field>
                <Field label="Reporting timezone" hint="An IANA zone name such as Australia/Sydney. Hour-of-day rollups use it.">
                  <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </Field>
                <Field label="Key events" hint="Event names counted as conversions, separated by commas.">
                  <input value={keyEvents} onChange={(e) => setKeyEvents(e.target.value)} />
                </Field>
              </>
            )}
            <div className="flex justify-between">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(0)}>
                Back
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={!canNext1} onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <p className="text-[13.5px]" style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
              {mode === 'ga4'
                ? 'Optional. If this property exports to BigQuery, daily rollups can come from the export instead of the Data API, with no sampling and no API quota. Realtime stays on Google Analytics.'
                : 'The export dataset to read. The jobs project is billed for the queries.'}
            </p>
            <Field label="Jobs project" hint="The Google Cloud project that runs the queries and is billed for them.">
              <input value={bqProject} onChange={(e) => setBqProject(e.target.value)} placeholder="my-gcp-project" />
            </Field>
            <Field label="Dataset" hint="analytics_<property id>, or project.dataset for a dataset in another project.">
              <input value={bqDataset} onChange={(e) => setBqDataset(e.target.value)} placeholder="analytics_123456789" />
            </Field>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" className="btn btn-ghost btn-sm" disabled={pending || !bqProject || !bqDataset} onClick={runBqTest}>
                {pending ? <span className="spinner" aria-hidden /> : null} Test connection
              </button>
              {bqTest ? (
                <span className="mono-micro" style={{ color: 'var(--ok)' }}>
                  {bqTest.tables} day tables · {bqTest.first} to {bqTest.last}
                </span>
              ) : null}
            </div>
            {bqError ? <div className="alert error">{bqError}</div> : null}
            <div className="flex justify-between">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={mode === 'bigquery' && !bqTest} onClick={() => setStep(3)}>
                {mode === 'ga4' && !bqTest ? 'Skip' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            {mode === 'ga4' ? (
              <Field label="Backfill" hint="How much history to pull now. The hourly refresh keeps the last three days current from then on.">
                <Select
                  value={days}
                  onChange={setDays}
                  ariaLabel="Backfill window"
                  options={[
                    { value: '30', label: 'Last 30 days' },
                    { value: '90', label: 'Last 90 days' },
                    { value: '180', label: 'Last 180 days' },
                    { value: '365', label: 'Last 12 months' },
                  ]}
                />
              </Field>
            ) : (
              <Field label="Window" hint={`Days to ingest from the export${bqTest?.first ? `. Available: ${bqTest.first} to ${bqTest.last}` : ''}. Each report family is one query per 31-day chunk, and the jobs project is billed for the bytes scanned.`}>
                <div className="flex flex-wrap items-center gap-2">
                  <DatePicker value={from} onChange={setFrom} ariaLabel="From" />
                  <span className="mono-micro">to</span>
                  <DatePicker value={to} onChange={setTo} ariaLabel="To" />
                </div>
              </Field>
            )}
            {error ? <div className="alert error">{error}</div> : null}
            <div className="flex justify-between">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(2)}>
                Back
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={pending || !canCreate} onClick={create}>
                {pending ? <span className="spinner" aria-hidden /> : null} Create site and start ingesting
              </button>
            </div>
          </div>
        )}
      </div>
      {hasSites ? (
        <p className="mt-4 text-[12.5px]" style={{ color: 'var(--muted)' }}>
          Adding another site. The new site becomes the current one when it is created.
        </p>
      ) : null}
    </div>
  );
}
