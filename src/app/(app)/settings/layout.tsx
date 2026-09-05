import type { CSSProperties, ReactNode } from 'react';
import { TabLinks } from '@/components/ui/Tabs';

/**
 * Settings is a tabbed container: the header macro renders once here, the
 * tray follows, and each tab's own head is a `SubHead`. Nothing that varies
 * per tab may sit above the strip.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <h1 className="view-title rv">Settings</h1>
      <p className="lede rv" style={{ '--i': 1 } as CSSProperties}>
        The sites this deployment reads, the ingestion runs that fill it, and what it is.
      </p>
      <div className="rv mt-6" style={{ '--i': 1 } as CSSProperties}>
        <TabLinks
          className=""
          tabs={[
            { href: '/settings/sites', label: 'Sites' },
            { href: '/settings/ingestion', label: 'Ingestion' },
            { href: '/settings/about', label: 'About' },
          ]}
        />
      </div>
      <div className="tab-panel">{children}</div>
    </div>
  );
}
