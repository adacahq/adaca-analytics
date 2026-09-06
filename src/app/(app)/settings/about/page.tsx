import SubHead from '@/components/ui/SubHead';

const REPO = 'https://github.com/adacahq/adaca-analytics';

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
          Built and maintained by Adaca, a software consultancy. The source, the README and the issue tracker are at{' '}
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
          There is no sign-in. Protect this deployment with Cloudflare Access or the built-in Basic Auth secrets. The README explains both.
        </div>
      </div>
    </div>
  );
}
