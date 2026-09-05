import { googleJson } from './http';
import { SCOPES } from './auth';

const BQ = 'https://bigquery.googleapis.com/bigquery/v2';

export interface QueryResult {
  columns: string[];
  rows: Record<string, string | null>[];
  totalRows: number;
}

interface QueryResponse {
  jobComplete?: boolean;
  jobReference?: { jobId?: string; location?: string };
  schema?: { fields?: { name: string; type: string }[] };
  rows?: { f: { v: string | null }[] }[];
  totalRows?: string;
  pageToken?: string;
  errors?: { message?: string }[];
}

function collect(res: QueryResponse, columns: string[], into: Record<string, string | null>[]) {
  for (const r of res.rows ?? []) {
    const obj: Record<string, string | null> = {};
    r.f.forEach((cell, i) => {
      obj[columns[i] ?? String(i)] = cell.v;
    });
    into.push(obj);
  }
}

/**
 * Run a SQL query and return every row (paging through results). Standard
 * SQL; every value comes back as a string (BigQuery's JSON wire format), so
 * callers parse numbers themselves. `timeoutMs` is the synchronous wait per
 * call; jobs that take longer are polled.
 */
export async function bigQuery(projectId: string, sql: string, opts: { timeoutMs?: number; maxRows?: number } = {}): Promise<QueryResult> {
  const first = await googleJson<QueryResponse>(`${BQ}/projects/${encodeURIComponent(projectId)}/queries`, {
    body: { query: sql, useLegacySql: false, timeoutMs: opts.timeoutMs ?? 25_000, maxResults: 10_000 },
    scopes: [SCOPES.bigquery],
  });
  const jobId = first.jobReference?.jobId;
  const location = first.jobReference?.location;
  let res = first;
  // Poll until the job completes (rare for our aggregate queries, but possible on cold datasets).
  let polls = 0;
  while (!res.jobComplete && jobId && polls < 20) {
    polls++;
    res = await googleJson<QueryResponse>(
      `${BQ}/projects/${encodeURIComponent(projectId)}/queries/${encodeURIComponent(jobId)}?timeoutMs=25000&maxResults=10000${location ? `&location=${encodeURIComponent(location)}` : ''}`,
      { scopes: [SCOPES.bigquery] },
    );
  }
  if (!res.jobComplete) throw new Error('BigQuery job did not complete in time');
  if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '));
  const columns = (res.schema?.fields ?? []).map((f) => f.name);
  const rows: Record<string, string | null>[] = [];
  collect(res, columns, rows);
  const max = opts.maxRows ?? 500_000;
  let pageToken = res.pageToken;
  while (pageToken && jobId && rows.length < max) {
    const page = await googleJson<QueryResponse>(
      `${BQ}/projects/${encodeURIComponent(projectId)}/queries/${encodeURIComponent(jobId)}?maxResults=10000&pageToken=${encodeURIComponent(pageToken)}${location ? `&location=${encodeURIComponent(location)}` : ''}`,
      { scopes: [SCOPES.bigquery] },
    );
    collect(page, columns, rows);
    pageToken = page.pageToken;
  }
  return { columns, rows, totalRows: Number(res.totalRows ?? rows.length) };
}
