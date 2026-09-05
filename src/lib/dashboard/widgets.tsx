import type { ChartType } from './types';

export interface WidgetMeta {
  type: ChartType;
  title: string;
  description: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  /** False for the note widget, which has no query. */
  needsData: boolean;
}

/** The chart-type catalogue. Adding a presentation = one entry + a body renderer. */
export const WIDGETS: WidgetMeta[] = [
  { type: 'kpi', title: 'Number', description: 'One figure with its change against the previous period and a sparkline.', defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, needsData: true },
  { type: 'line', title: 'Line', description: 'A metric over time, optionally against the previous period.', defaultSize: { w: 8, h: 4 }, minSize: { w: 3, h: 3 }, needsData: true },
  { type: 'column', title: 'Columns', description: 'Vertical bars — over time, or one per category.', defaultSize: { w: 6, h: 4 }, minSize: { w: 3, h: 3 }, needsData: true },
  { type: 'bar', title: 'Bars', description: 'Horizontal bars, longest first.', defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, needsData: true },
  { type: 'donut', title: 'Donut', description: 'Share of the total across the top categories.', defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, needsData: true },
  { type: 'list', title: 'Ranked list', description: 'Top entries with their value and share bar — the classic analytics list.', defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, needsData: true },
  { type: 'table', title: 'Table', description: 'Rows with several metrics side by side, sortable.', defaultSize: { w: 12, h: 5 }, minSize: { w: 4, h: 3 }, needsData: true },
  { type: 'note', title: 'Note', description: 'Free text in Markdown — a heading, a caveat, a link.', defaultSize: { w: 4, h: 2 }, minSize: { w: 2, h: 2 }, needsData: false },
];

export const WIDGET_BY_TYPE: Record<ChartType, WidgetMeta> = Object.fromEntries(WIDGETS.map((w) => [w.type, w])) as Record<ChartType, WidgetMeta>;

export function isChartType(t: unknown): t is ChartType {
  return typeof t === 'string' && t in WIDGET_BY_TYPE;
}
