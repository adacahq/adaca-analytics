import { countDashboards, createDashboard } from '@/lib/db/dashboards';
import { TEMPLATES } from './templates';

/**
 * First run: seed the six default dashboards from the templates. Idempotent
 * — only when the table is empty, so a workspace that deleted nothing and
 * customised everything is never overwritten.
 */
export async function ensureDefaultDashboards(): Promise<void> {
  if ((await countDashboards()) > 0) return;
  for (const t of TEMPLATES) {
    await createDashboard({ slug: t.slug, name: t.name, kind: 'default', template_key: t.key, position: t.position, layout: t.layout });
  }
}
