import { accessToken } from './auth';

export class GoogleApiError extends Error {
  status: number;
  reason: string | null;
  constructor(status: number, message: string, reason: string | null = null) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
    this.reason = reason;
  }
  /** Permission problems get a hint the operator can act on. */
  get hint(): string {
    if (this.status === 403 || this.status === 401) {
      return 'Grant the service account access: the Viewer role on the GA4 property, under Admin, then Property access management, or the BigQuery roles on the export project.';
    }
    if (this.status === 429) return 'Google API quota is exhausted for this property. Ingestion resumes on the next tick.';
    return '';
  }
}

interface ErrorBody {
  error?: { code?: number; message?: string; status?: string; errors?: { reason?: string }[] };
}

/** Authenticated JSON call to a Google API. Throws GoogleApiError on non-2xx. */
export async function googleJson<T>(url: string, init: { method?: 'GET' | 'POST'; body?: unknown; scopes?: string[] } = {}): Promise<T> {
  const token = await accessToken(init.scopes);
  const res = await fetch(url, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    let reason: string | null = null;
    try {
      const body = (await res.json()) as ErrorBody;
      msg = body.error?.message ?? msg;
      reason = body.error?.status ?? body.error?.errors?.[0]?.reason ?? null;
    } catch {
      // keep the status text
    }
    throw new GoogleApiError(res.status, msg, reason);
  }
  return (await res.json()) as T;
}
