export default function Loader() {
  return (
    <div className="flex justify-center items-center py-10">
      <div className="flex flex-col items-center gap-3">
        <span className="spin" aria-hidden />
        <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
          Loading…
        </p>
      </div>
    </div>
  );
}
