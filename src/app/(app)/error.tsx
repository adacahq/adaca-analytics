'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-12">
      <span
        className="mono"
        style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--crit)', textTransform: 'uppercase' }}
      >
        Something went wrong
      </span>
      <h1 className="mt-3" style={{ fontSize: 24, fontWeight: 500 }}>
        Couldn&rsquo;t load this page
      </h1>
      <p className="mt-2 text-[14px]" style={{ color: 'var(--muted)' }}>
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button type="button" className="btn btn-ghost btn-sm mt-6" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
