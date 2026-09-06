'use client';

import { ListBody } from '@/components/dashboard/WidgetBody';
import { ENTITY_BY_KIND, entityHref, type EntityKind } from '@/lib/analytics/entities';
import { METRIC_BY_KEY, type MetricKey } from '@/lib/analytics/metrics';

export interface BreakdownItem {
  label: string;
  dimLabel: string;
  linkTo: EntityKind | null;
  metric: MetricKey;
  fromPairs: boolean;
  rows: { key: string; value: number; share: number }[];
  total: number;
}

/** One breakdown of an entity: a ranked list whose rows open their own entity pages; "See all" opens the full table. */
export default function BreakdownCard({ breakdown, query, seeAll }: { breakdown: BreakdownItem; query: string; seeAll?: string | null }) {
  const metric = METRIC_BY_KEY[breakdown.metric];
  const linkTo = breakdown.linkTo;
  const mono = linkTo ? ENTITY_BY_KIND[linkTo].mono : false;
  const href = linkTo ? (row: { key: string }) => (row.key === '(other)' ? null : entityHref(linkTo, row.key, query)) : null;
  return (
    <section className="chart-card widget bcard">
      <div className="chart-head">
        <span className="field-label truncate" style={{ margin: 0 }}>
          {breakdown.label}
        </span>
        {breakdown.rows.length === 0 ? null : seeAll ? (
          <a className="muted-link seeall" href={seeAll} title="Every row, every metric">
            top {breakdown.rows.length} · see all
          </a>
        ) : (
          <span className="micro">top {breakdown.rows.length}</span>
        )}
      </div>
      <div className="wbody">
        <ListBody rows={breakdown.rows} metric={metric} dimLabel={breakdown.dimLabel} href={href} mono={mono} />
      </div>
    </section>
  );
}
