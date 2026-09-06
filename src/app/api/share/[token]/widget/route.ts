import { getShareByToken } from '@/lib/db/shares';
import { getDashboardById } from '@/lib/db/dashboards';
import { getSite } from '@/lib/db/sites';
import { rangeFor } from '@/lib/context';
import { runWidgetQuery } from '@/lib/analytics/query';
import { parseSegment } from '@/lib/analytics/segments';
import { GoogleApiError } from '@/lib/google/http';
import type { RangeParams } from '@/lib/analytics/ranges';

const NO_STORE = { 'Cache-Control': 'no-store' };

function lockOf(raw: string | null): RangeParams | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RangeParams;
  } catch {
    return null;
  }
}

/**
 * Widget data for a shared dashboard. The only data path a share reader has:
 * it resolves a token to its dashboard and site, serves only widgets of that
 * layout, honours the share's locked period and pinned segment, and never
 * reads a site or segment named by the caller. Open in the worker's gate for
 * every method; the share page itself is open for GET only, so no server
 * action can be invoked through a share URL.
 */
export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  const share = await getShareByToken(token);
  if (!share) return Response.json({ ok: false, error: 'This link is no longer valid' }, { status: 404, headers: NO_STORE });
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  const [site, dashboard] = await Promise.all([getSite(share.site_id), getDashboardById(share.dashboard_id)]);
  const widget = dashboard?.layout.find((w) => w.id === id);
  if (!site || !dashboard || !widget) return Response.json({ ok: false, error: 'Widget not found' }, { status: 404, headers: NO_STORE });

  const lock = lockOf(share.lock_range);
  const params: RangeParams = lock ?? { range: url.searchParams.get('range'), from: url.searchParams.get('from'), to: url.searchParams.get('to'), compare: url.searchParams.get('compare') };
  try {
    const range = await rangeFor(site, params);
    const data = await runWidgetQuery(site, widget.type, widget.config, range, share.seg ? parseSegment(share.seg) : null);
    return Response.json({ ok: true, data }, { headers: NO_STORE });
  } catch (e) {
    const error = e instanceof GoogleApiError ? (e.status === 429 ? 'Google quota reached; retrying soon' : `Google: ${e.message}`) : e instanceof Error ? e.message : 'Query failed';
    return Response.json({ ok: false, error }, { status: 500, headers: NO_STORE });
  }
}
