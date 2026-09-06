'use client';

import { useEffect, useState } from 'react';
import WidgetCard from './WidgetCard';
import { WidgetBody } from './WidgetBody';
import { loadWidget } from '@/lib/dashboard/data';
import { WIDGET_BY_TYPE } from '@/lib/dashboard/widgets';
import { DATASET_BY_KEY } from '@/lib/analytics/catalog';
import { METRIC_BY_KEY, isMetricKey } from '@/lib/analytics/metrics';
import type { RangeParams } from '@/lib/analytics/ranges';
import type { WidgetData, WidgetInstance } from '@/lib/dashboard/types';

const REALTIME_EVERY_MS = 30_000;

function defaultTitle(instance: WidgetInstance): string {
  const ds = instance.config.dataset ? DATASET_BY_KEY[instance.config.dataset] : undefined;
  if (!ds) return WIDGET_BY_TYPE[instance.type].title;
  const m = isMetricKey(instance.config.metric) && ds.metrics.includes(instance.config.metric) ? METRIC_BY_KEY[instance.config.metric] : METRIC_BY_KEY[ds.defaultMetric];
  return ds.dim === 'none' ? m.label : `${ds.label} · ${m.short}`;
}

/** Loads a widget's data (for data widgets) and renders it inside the card. */
export default function WidgetView({
  siteId,
  instance,
  range,
  editing,
  onEdit,
  onDuplicate,
  onRemove,
  onMove,
  canMove,
}: {
  siteId: string;
  instance: WidgetInstance;
  range: RangeParams;
  editing: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove?: (dir: -1 | 1) => void;
  canMove?: [boolean, boolean];
}) {
  const meta = WIDGET_BY_TYPE[instance.type];
  const ds = instance.config.dataset ? DATASET_BY_KEY[instance.config.dataset] : undefined;
  const live = !!ds?.live;
  const [data, setData] = useState<WidgetData | null>(meta.needsData ? null : { kind: 'empty' });
  const [error, setError] = useState<string | null>(null);
  const cfgKey = JSON.stringify(instance.config);
  const rangeKey = `${range.range ?? ''}|${range.from ?? ''}|${range.to ?? ''}|${range.compare ?? ''}`;

  // All setState is inside async callbacks. Stale data stays visible while a
  // re-fetch resolves; realtime widgets poll every 30 s.
  useEffect(() => {
    if (!meta.needsData) return;
    let alive = true;
    async function fetchOnce() {
      const r = await loadWidget(siteId, instance.type, instance.config, range);
      if (!alive) return;
      if (r.ok) {
        setData(r.data);
        setError(null);
      } else {
        setError(r.error);
      }
    }
    void fetchOnce();
    const timer = live ? setInterval(() => void fetchOnce(), REALTIME_EVERY_MS) : null;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // cfgKey/rangeKey are stable serialisations of the config and range (deep-compare on purpose).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, instance.type, cfgKey, rangeKey, meta.needsData, live]);

  const loading = meta.needsData && data === null && !error;

  return (
    <WidgetCard
      title={instance.title || defaultTitle(instance)}
      caption={live ? 'last 30 min' : undefined}
      editing={editing}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onRemove={onRemove} onMove={onMove} canMove={canMove}
      loading={loading}
      error={error}
    >
      {!loading && !error && <WidgetBody instance={instance} data={data} />}
    </WidgetCard>
  );
}
