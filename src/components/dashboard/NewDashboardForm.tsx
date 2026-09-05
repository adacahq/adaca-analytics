'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createDashboardAction } from '@/lib/dashboard/actions';
import { TEMPLATES } from '@/lib/dashboard/templates';
import { dashboardHref } from '@/lib/nav';

/** /d/new — a name, and either a blank board or a copy of one of the six templates. */
export default function NewDashboardForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      const r = await createDashboardAction({ name, templateKey: template });
      if (r.ok) {
        router.push(dashboardHref(r.data.slug));
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-6" style={{ maxWidth: 760 }}>
      <div className="field">
        <span className="field-label">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marketing weekly" autoFocus />
      </div>
      <div>
        <span className="field-label">Start from</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          <button type="button" className={`card pick${template === null ? ' on' : ''}`} onClick={() => setTemplate(null)}>
            <h3>Blank</h3>
            <p className="text-[12.5px] mt-1.5" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              An empty board. Add widgets one at a time.
            </p>
          </button>
          {TEMPLATES.map((t) => (
            <button key={t.key} type="button" className={`card pick${template === t.key ? ' on' : ''}`} onClick={() => setTemplate(t.key)}>
              <h3>{t.name}</h3>
              <p className="text-[12.5px] mt-1.5" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                {t.description}
              </p>
            </button>
          ))}
        </div>
      </div>
      {error ? <div className="alert error">{error}</div> : null}
      <div className="flex justify-end">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending || !name.trim()} onClick={create}>
          {pending ? <span className="spinner" aria-hidden /> : null} Create dashboard
        </button>
      </div>
    </div>
  );
}
