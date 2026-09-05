import SubHead from '@/components/ui/SubHead';

export const dynamic = 'force-dynamic';

export default function IngestionPage() {
  return (
    <div>
      <SubHead title="Ingestion">Daily rollups pulled from Google, one run at a time.</SubHead>
      <div className="empty mt-6">
        <span className="zone-label">Runs</span>
        <p>Run history and the Run now control land with the ingestion engine.</p>
      </div>
    </div>
  );
}
