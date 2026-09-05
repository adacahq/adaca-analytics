import type { CSSProperties } from 'react';

export const dynamic = 'force-dynamic';

export default function SetupPage() {
  return (
    <div>
      <h1 className="view-title rv">Connect a property</h1>
      <p className="lede rv" style={{ '--i': 1 } as CSSProperties}>
        Point Adaca Analytics at a Google Analytics 4 property. The setup wizard lands in the next phase.
      </p>
      <div className="wsteps rv" style={{ '--i': 2 } as CSSProperties}>
        <div className="ws on"><span>1 · Credentials</span></div>
        <span className="wl" />
        <div className="ws"><span>2 · Property</span></div>
        <span className="wl" />
        <div className="ws"><span>3 · BigQuery</span></div>
        <span className="wl" />
        <div className="ws"><span>4 · Backfill</span></div>
      </div>
      <div className="empty mt-8">
        <span className="zone-label">Setup</span>
        <h3 className="mt-3.5" style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--fg)' }}>
          No sites yet
        </h3>
        <p>Phase 1 placeholder — the wizard verifies the service account, lists your properties and starts the first backfill.</p>
      </div>
    </div>
  );
}
