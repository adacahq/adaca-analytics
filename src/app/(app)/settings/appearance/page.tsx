import SubHead from '@/components/ui/SubHead';
import AppearancePanel from '@/components/settings/AppearancePanel';
import { getPalette } from '@/lib/db/settings';

export const dynamic = 'force-dynamic';

export default async function AppearancePage() {
  const palette = await getPalette();
  return (
    <div>
      <SubHead title="Appearance">The chart palette for this deployment. Light and dark are each reader’s own choice, in the topbar.</SubHead>
      <div className="mt-6">
        <AppearancePanel palette={palette} />
      </div>
    </div>
  );
}
