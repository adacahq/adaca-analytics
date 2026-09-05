import SubHead from '@/components/ui/SubHead';

export default function AboutPage() {
  return (
    <div>
      <SubHead title="About">Adaca Analytics 0.1.0 — open source, MIT.</SubHead>
      <div className="alert mt-6">
        There is no sign-in. Protect this deployment with Cloudflare Access or the built-in Basic Auth secrets — see the README.
      </div>
    </div>
  );
}
