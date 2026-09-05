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
        Page Not Found
      </h1>
      <p className="mt-2 text-[14px]" style={{ color: 'var(--muted)' }}>
        There is nothing at this address. The page may have been renamed or deleted.
      </p>
      <Link href="/" className="btn btn-ghost btn-sm mt-6">
        Back to Home
      </Link>
    </div>
  );
}
