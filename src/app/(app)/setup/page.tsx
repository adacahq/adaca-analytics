import type { CSSProperties } from 'react';
import SetupWizard from '@/components/setup/SetupWizard';
import { serviceAccountStatus } from '@/lib/google/auth';
import { listProperties, type PropertySummary } from '@/lib/google/admin';
import { listSites } from '@/lib/db/sites';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const credentials = serviceAccountStatus();
  let properties: PropertySummary[] | null = null;
  let propertiesError: string | null = null;
  if (credentials.ok) {
    try {
      properties = await listProperties();
    } catch (e) {
      propertiesError = e instanceof Error ? `${e.message}${'hint' in e && typeof e.hint === 'string' ? ` ${e.hint}` : ''}` : String(e);
    }
  }
  const sites = await listSites();

  return (
    <div>
      <h1 className="view-title rv">{sites.length ? 'Add a site' : 'Connect a property'}</h1>
      <p className="lede rv" style={{ '--i': 1 } as CSSProperties}>
        Point Adaca Analytics at a Google Analytics 4 property. Daily rollups are pulled into this deployment's own database; realtime stays live.
      </p>
      <div className="rv" style={{ '--i': 2 } as CSSProperties}>
        <SetupWizard credentials={credentials} properties={properties} propertiesError={propertiesError} hasSites={sites.length > 0} />
      </div>
    </div>
  );
}
