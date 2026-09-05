import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-12">
      <span
        className="mono"
        style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}
      >
        404
      </span>
      <h1 className="mt-3" style={{ fontSize: 28, fontWeight: 500 }}>
        Page not found
      </h1>
      <p className="mt-2 text-[14px]" style={{ color: 'var(--muted)' }}>
        The page you&rsquo;re looking for doesn&rsquo;t exist or was renamed.
      </p>
      <Link href="/" className="btn btn-ghost btn-sm mt-6">
        Back home
      </Link>
    </div>
  );
}
