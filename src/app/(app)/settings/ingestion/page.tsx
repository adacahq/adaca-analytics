import SubHead from '@/components/ui/SubHead';
import IngestBanner, { type RunProgress } from '@/components/ingest/IngestBanner';
import IngestControls from '@/components/settings/IngestControls';
import { listSites } from '@/lib/db/sites';
import { listActiveRuns, listRuns } from '@/lib/db/ingestRuns';
import { unitsFor } from '@/lib/analytics/ingest';
import { fmtDay, fmtInstant, fmtInt } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS_PILL: Record<string, string> = { queued: 'pill', running: 'pill doing', done: 'pill ok', failed: 'pill crit' };

export default async function IngestionPage() {
  const [sites, active, runs] = await Promise.all([listSites(), listActiveRuns(), listRuns(40)]);
  const byId = new Map(sites.map((s) => [s.id, s]));
  const progress: RunProgress[] = active.map((r) => {
    const site = byId.get(r.site_id);
    return {
      id: r.id,
      site_id: r.site_id,
      kind: r.kind,
      from: r.from_date,
      to: r.to_date,
      units: r.units,
      total: site ? unitsFor(site, r.from_date, r.to_date) : 0,
      rows: r.rows_written,
      status: r.status,
    };
  });
  const busySites = new Set(active.map((r) => r.site_id));

  return (
    <div>
      <SubHead title="Ingestion">
        Daily rollups arrive in small units. The cron runs every 15 minutes, this page works the queue faster while it is open, and every site is refreshed hourly for its trailing three days.
      </SubHead>

      {progress.length > 0 ? (
        <div className="mt-6">
          <IngestBanner initial={progress} all />
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {sites.map((s) => (
          <div key={s.id} className="card flex items-center justify-between gap-4 flex-wrap" style={{ padding: '14px 18px' }}>
            <div className="min-w-0">
              <div style={{ fontWeight: 500 }}>{s.name}</div>
              <div className="mono-micro" style={{ marginTop: 4 }}>
                {s.primary_source === 'bigquery' ? 'BigQuery' : 'GA4 API'} · {s.last_ingested_date ? `ingested to ${fmtDay(s.last_ingested_date)}` : 'nothing ingested yet'}
              </div>
            </div>
            <IngestControls site={s} busy={busySites.has(s.id)} />
          </div>
        ))}
        {sites.length === 0 ? (
          <div className="empty">
            <span className="zone-label">Ingestion</span>
            <p>Add a site to start ingesting.</p>
          </div>
        ) : null}
      </div>

      <h3 className="mt-10" style={{ fontSize: 15, fontWeight: 500 }}>
        Recent Runs
      </h3>
      <div className="tscroll mt-3">
        <table className="dtable compact">
          <thead>
            <tr>
              <th>Site</th>
              <th>Kind</th>
              <th>Window</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Units</th>
              <th style={{ textAlign: 'right' }}>Rows</th>
              <th>Started</th>
              <th>Finished</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{byId.get(r.site_id)?.name ?? r.site_id}</td>
                <td className="mono">{r.kind}</td>
                <td className="mono">
                  {fmtDay(r.from_date)} to {fmtDay(r.to_date)}
                </td>
                <td>
                  <span className={STATUS_PILL[r.status] ?? 'pill'}>{r.status}</span>
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {r.units}
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {fmtInt(r.rows_written)}
                </td>
                <td className="mono">{r.started_at ? fmtInstant(r.started_at) : '–'}</td>
                <td className="mono">{r.finished_at ? fmtInstant(r.finished_at) : '–'}</td>
                <td style={{ color: 'var(--crit)', maxWidth: 360, fontSize: 12 }}>{r.error ?? ''}</td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '24px 14px', color: 'var(--muted)' }}>
                  No runs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
