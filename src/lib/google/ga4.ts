import { googleJson } from './http';
import { SCOPES } from './auth';

const DATA = 'https://analyticsdata.googleapis.com/v1beta';

export interface DateRangeSpec {
  startDate: string; // YYYY-MM-DD or 'today' / 'yesterday' / 'NdaysAgo'
  endDate: string;
}

export interface DimensionFilter {
  /** A single-dimension filter; enough for widgets (eq / contains). */
  fieldName: string;
  matchType: 'EXACT' | 'CONTAINS' | 'BEGINS_WITH';
  value: string;
  not?: boolean;
}

export interface ReportRequest {
  dimensions: string[];
  metrics: string[];
  dateRanges: DateRangeSpec[];
  filters?: DimensionFilter[];
  orderBy?: { metric?: string; dimension?: string; desc?: boolean };
  limit?: number;
  offset?: number;
  keepEmptyRows?: boolean;
}

export interface ReportRow {
  dims: string[];
  mets: number[];
}

export interface ReportResult {
  rows: ReportRow[];
  /** Total rows matching (before limit/offset). */
  rowCount: number;
  dimensionHeaders: string[];
  metricHeaders: string[];
}

interface ApiRow {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
}
interface ApiReport {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string; type: string }[];
  rows?: ApiRow[];
  rowCount?: number;
}

function filterExpression(filters: DimensionFilter[] | undefined): Record<string, unknown> | undefined {
  if (!filters?.length) return undefined;
  const exprs = filters.map((f) => {
    const inner = { filter: { fieldName: f.fieldName, stringFilter: { matchType: f.matchType, value: f.value, caseSensitive: false } } };
    return f.not ? { notExpression: inner } : inner;
  });
  return exprs.length === 1 ? exprs[0] : { andGroup: { expressions: exprs } };
}

function toResult(r: ApiReport): ReportResult {
  return {
    dimensionHeaders: (r.dimensionHeaders ?? []).map((h) => h.name),
    metricHeaders: (r.metricHeaders ?? []).map((h) => h.name),
    rowCount: r.rowCount ?? 0,
    rows: (r.rows ?? []).map((row) => ({
      dims: (row.dimensionValues ?? []).map((d) => d.value),
      mets: (row.metricValues ?? []).map((m) => Number(m.value) || 0),
    })),
  };
}

function body(req: ReportRequest): Record<string, unknown> {
  const b: Record<string, unknown> = {
    dimensions: req.dimensions.map((name) => ({ name })),
    metrics: req.metrics.map((name) => ({ name })),
    dateRanges: req.dateRanges,
    limit: req.limit ?? 10_000,
    offset: req.offset ?? 0,
    keepEmptyRows: req.keepEmptyRows ?? false,
    returnPropertyQuota: false,
  };
  const df = filterExpression(req.filters);
  if (df) b.dimensionFilter = df;
  if (req.orderBy) {
    b.orderBys = [
      req.orderBy.metric
        ? { metric: { metricName: req.orderBy.metric }, desc: req.orderBy.desc ?? true }
        : { dimension: { dimensionName: req.orderBy.dimension }, desc: req.orderBy.desc ?? false },
    ];
  }
  return b;
}

/** One page of a standard report. `limit` caps at the API's 250k. */
export async function runReport(propertyId: string, req: ReportRequest): Promise<ReportResult> {
  const r = await googleJson<ApiReport>(`${DATA}/properties/${propertyId}:runReport`, { body: body(req), scopes: [SCOPES.analytics] });
  return toResult(r);
}

/** Realtime: the last 30 minutes. Dimensions/metrics use the realtime schema. */
export async function runRealtimeReport(
  propertyId: string,
  req: { dimensions?: string[]; metrics: string[]; limit?: number; orderByMetric?: string; minuteRanges?: { startMinutesAgo: number; endMinutesAgo?: number }[] },
): Promise<ReportResult> {
  const b: Record<string, unknown> = {
    dimensions: (req.dimensions ?? []).map((name) => ({ name })),
    metrics: req.metrics.map((name) => ({ name })),
    limit: req.limit ?? 50,
  };
  if (req.orderByMetric) b.orderBys = [{ metric: { metricName: req.orderByMetric }, desc: true }];
  if (req.minuteRanges) b.minuteRanges = req.minuteRanges;
  const r = await googleJson<ApiReport>(`${DATA}/properties/${propertyId}:runRealtimeReport`, { body: b, scopes: [SCOPES.analytics] });
  return toResult(r);
}
