import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { bqSql, bqTablesSql, datasetRef } from './bq-sql';
import { REPORTS } from './reports';

const SAMPLE = { datasetRef: 'bigquery-public-data.ga4_obfuscated_sample_ecommerce', timezone: 'America/Los_Angeles', keyEvents: ['purchase'] };

describe('bq-sql (pure)', () => {
  it('produces a query for every BigQuery-capable family and null otherwise', () => {
    for (const r of REPORTS) {
      const sql = bqSql(SAMPLE, r.key, '2021-01-30', '2021-01-31');
      if (r.bq) {
        expect(sql, r.key).toBeTruthy();
        expect(sql).toContain('events_*');
        expect(sql).toContain("_TABLE_SUFFIX BETWEEN '20210130' AND '20210131'");
        expect(sql).toMatch(/AS key1,/);
        expect(sql).toMatch(/AS event_count/);
      } else {
        expect(sql).toBeNull();
      }
    }
  });

  it('refuses unsafe identifiers and dates', () => {
    expect(() => bqSql({ ...SAMPLE, datasetRef: 'x; DROP' }, 'totals', '2021-01-01', '2021-01-02')).toThrow();
    expect(() => bqSql(SAMPLE, 'totals', '2021-1-1', '2021-01-02')).toThrow();
  });

  it('resolves dataset references', () => {
    expect(datasetRef({ bq_project_id: 'p', bq_dataset: 'analytics_1' })).toBe('p.analytics_1');
    expect(datasetRef({ bq_project_id: 'p', bq_dataset: 'other.analytics_1' })).toBe('other.analytics_1');
    expect(() => datasetRef({ bq_project_id: null, bq_dataset: 'analytics_1' })).toThrow();
  });

  it('lists tables', () => {
    expect(bqTablesSql(SAMPLE.datasetRef)).toContain('INFORMATION_SCHEMA.TABLES');
  });
});

/**
 * Live check against the public sample dataset. Runs only when a
 * service-account key file is provided (never in CI):
 *   GOOGLE_SA_KEY_FILE=~/.secrets/adaca-analytics-sa.json npm test
 */
const KEY_FILE = process.env.GOOGLE_SA_KEY_FILE;

async function token(): Promise<{ access: string; project: string }> {
  const key = JSON.parse(readFileSync(KEY_FILE!.replace(/^~/, process.env.HOME ?? ''), 'utf8')) as {
    client_email: string;
    private_key: string;
    token_uri: string;
    project_id: string;
  };
  const b64 = (o: unknown) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/bigquery.readonly', aud: key.token_uri, iat: now, exp: now + 600 })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url');
  const res = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = (await res.json()) as { access_token: string };
  return { access: j.access_token, project: key.project_id };
}

async function run(access: string, project: string, sql: string) {
  const res = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${project}/queries`, {
    method: 'POST',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sql, useLegacySql: false, timeoutMs: 60000, maxResults: 5000 }),
  });
  const j = (await res.json()) as { rows?: { f: { v: string | null }[] }[]; schema?: { fields: { name: string }[] }; error?: { message: string }; jobComplete?: boolean };
  if (j.error) throw new Error(j.error.message);
  if (!j.jobComplete) throw new Error('job not complete');
  const cols = j.schema!.fields.map((f) => f.name);
  return (j.rows ?? []).map((r) => Object.fromEntries(r.f.map((c, i) => [cols[i], c.v])));
}

describe.skipIf(!KEY_FILE)('bq-sql (live, public sample dataset)', () => {
  it('every family query runs and returns sane rows', { timeout: 240_000 }, async () => {
    const { access, project } = await token();
    for (const r of REPORTS.filter((x) => x.bq)) {
      const sql = bqSql(SAMPLE, r.key, '2021-01-30', '2021-01-31')!;
      const rows = await run(access, project, sql);
      expect(rows.length, `${r.key} rows`).toBeGreaterThan(0);
      for (const row of rows) {
        const sessions = Number(row.sessions);
        const engaged = Number(row.engaged_sessions);
        expect(row.date).toMatch(/^\d{8}$/);
        expect(engaged, `${r.key} engaged<=sessions`).toBeLessThanOrEqual(sessions);
        expect(Number(row.users), `${r.key} users>0`).toBeGreaterThan(0);
        expect(Number(row.event_count), `${r.key} events>0`).toBeGreaterThan(0);
      }
      if (r.key === 'totals') {
        // Two days → two rows, each with a few thousand sessions in the sample.
        expect(rows.length).toBe(2);
        expect(Number(rows[0].sessions)).toBeGreaterThan(1000);
        expect(Number(rows[0].key_events)).toBeGreaterThan(0);
      }
      if (r.key === 'event') {
        expect(rows.some((x) => x.key1 === 'purchase' && x.key2 === '1')).toBe(true);
      }
      if (r.key === 'channel') {
        expect(rows.some((x) => ['Direct', 'Organic Search', 'Referral'].includes(String(x.key1)))).toBe(true);
      }
    }
    const tables = await run(access, project, bqTablesSql(SAMPLE.datasetRef));
    expect(tables[0].first_table).toBe('events_20201101');
    expect(tables[0].last_table).toBe('events_20210131');
  });
});
