'use server';

import { getSite } from '@/lib/db/sites';
import { rangeFor } from '@/lib/context';
import { runWidgetQuery } from '@/lib/analytics/query';
import { GoogleApiError } from '@/lib/google/http';
import type { RangeParams } from '@/lib/analytics/ranges';
import type { ChartType, WidgetConfig, WidgetData } from '@/lib/dashboard/types';

/**
 * The one server action widgets call for their data. Validates the site,
 * resolves the range the way the page did, and never leaks a stack trace —
 * a widget shows a short reason instead.
 */
export async function loadWidget(
  siteId: string,
  type: ChartType,
  config: WidgetConfig,
  params: RangeParams,
): Promise<{ ok: true; data: WidgetData } | { ok: false; error: string }> {
  try {
    const site = await getSite(siteId);
    if (!site) return { ok: false, error: 'Site not found' };
    const range = rangeFor(site, params);
    const data = await runWidgetQuery(site, type, config, range);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof GoogleApiError) return { ok: false, error: e.status === 429 ? 'Google quota reached. Retrying soon.' : `Google: ${e.message}` };
    return { ok: false, error: e instanceof Error ? e.message : 'Query failed' };
  }
}
