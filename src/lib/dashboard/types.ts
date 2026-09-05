/** Shared types for dashboards and widgets. Pure — safe in tests and the browser. */

/** The presentation of a widget. Adding one = a registry entry + a body renderer. */
export type ChartType = 'kpi' | 'line' | 'bar' | 'column' | 'donut' | 'table' | 'list' | 'note';

export type SortDir = 'asc' | 'desc';
export type Bucket = 'day' | 'week' | 'month';

export type FilterOp = 'eq' | 'neq' | 'contains' | 'not_contains';
export interface Filter {
  /** 'key1' | 'key2' — which dimension of the dataset the filter reads. */
  dim: 'key1' | 'key2';
  op: FilterOp;
  value: string;
}

/**
 * What a widget shows. `dataset` points into the catalogue (category →
 * specific data); everything else refines it. Only the keys relevant to the
 * chart type are read.
 */
export interface WidgetConfig {
  dataset?: string;
  /** Primary metric key (kpi, line, bar, column, donut, list). */
  metric?: string;
  /** Column metrics for a table (dimension column is implicit). */
  metrics?: string[];
  limit?: number;
  sort?: { metric: string; dir: SortDir };
  filters?: Filter[];
  bucket?: Bucket;
  /** Show the previous period alongside (kpi delta, dashed line). */
  compare?: boolean;
  /** For list/bar: show each row's share of the total instead of the raw value. */
  showAs?: 'value' | 'percent';
  /** Note widgets: markdown body. */
  markdown?: string;
}

export interface WidgetInstance {
  id: string;
  type: ChartType;
  title?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: WidgetConfig;
}

export type DashboardKind = 'default' | 'custom';

export interface Dashboard {
  id: string;
  created_at: string;
  updated_at: string;
  slug: string;
  name: string;
  kind: DashboardKind;
  template_key: string | null;
  position: number;
  layout: WidgetInstance[];
}

/** One point of a time series. */
export interface Point {
  /** Bucket label: 'YYYY-MM-DD', 'YYYY-MM', a minute index for realtime, … */
  name: string;
  value: number;
  /** Comparison value for the same bucket in the previous period. */
  previous?: number;
}

/** Render-ready output of the query engine, by shape. */
export type WidgetData =
  | { kind: 'kpi'; value: number; previous: number | null; spark: number[] }
  | { kind: 'timeseries'; bucket: Bucket | 'minute'; points: Point[]; series?: { key: string; points: Point[] }[] }
  | { kind: 'ranked'; rows: { key: string; sub?: string; value: number; share: number }[]; total: number }
  | { kind: 'table'; columns: { key: string; label: string; metric: boolean }[]; rows: Record<string, string | number>[] }
  | { kind: 'empty'; reason?: string };
