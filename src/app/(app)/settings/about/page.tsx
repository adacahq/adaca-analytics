import SubHead from '@/components/ui/SubHead';

const REPO = 'https://github.com/adacahq/adaca-analytics';
const OPS = `${REPO}/blob/main/docs/operations.md#protecting-your-deployment`;

export default function AboutPage() {
  return (
    <div>
      <SubHead title="About">Adaca Analytics 0.1.0, open source under the MIT licence.</SubHead>
      <div className="mt-6 flex flex-col gap-4" style={{ maxWidth: 640 }}>
        <p className="text-[14px]" style={{ color: 'var(--fg)', lineHeight: 1.65 }}>
          Self-hosted dashboards for Google Analytics 4 on Cloudflare Workers. Daily rollups are stored in this deployment&rsquo;s own D1
          database, and realtime stays live on Google Analytics.
        </p>
        <p className="text-[14px]" style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
          Built and maintained by{' '}
          <a className="text-link" href="https://adaca.com" target="_blank" rel="noreferrer">
            Adaca
          </a>
          , a software consultancy that builds custom software, embeds senior engineers in client teams, and puts AI to work for its
          clients. The source, the docs and the issue tracker are at{' '}
          <a className="text-link" href={REPO} target="_blank" rel="noreferrer">
            github.com/adacahq/adaca-analytics
          </a>
          .
        </p>
        <p className="text-[14px]" style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
          <span className="mono">/api/health</span> reports whether the database answers and whether the Google secret is present. It is
          always open, so an uptime monitor has something to check.
        </p>
        <div className="alert">
          <span>
            There is no sign-in. Protect this deployment with Cloudflare Access or the built-in Basic Auth secrets; the{' '}
            <a className="text-link" href={OPS} target="_blank" rel="noreferrer">
              operations guide
            </a>{' '}
            explains both.
          </span>
        </div>
      </div>
    </div>
  );
}
