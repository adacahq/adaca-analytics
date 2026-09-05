/**
 * Theme-aware wordmark: the white logo on the dark theme, the ink logo on
 * the light theme. Both render; CSS (`.logo-light` / `.logo-dark` in
 * globals.css) shows the right one per `data-theme`, which the root layout
 * stamps before paint — so there is no flash.
 *
 * `variant="white"` opts out of the swap and always renders the white mark:
 * used inside the sidebar rail (`.sb`), which keeps its own dark palette in
 * both themes. Plain <img>, not next/image — the marks are inline SVG files
 * and need no optimisation pipeline.
 */
export default function Logo({
  className = 'h-6 w-auto',
  width = 110,
  height = 26,
  variant = 'auto',
}: {
  className?: string;
  width?: number;
  height?: number;
  variant?: 'auto' | 'white';
}) {
  if (variant === 'white') {
    return <img src="/logo-white.svg" alt="Adaca" width={width} height={height} className={className} />;
  }
  return (
    <span className="logo inline-flex items-center">
      <img src="/logo-white.svg" alt="Adaca" width={width} height={height} className={`logo-dark ${className}`} />
      <img src="/logo.svg" alt="" width={width} height={height} className={`logo-light ${className}`} />
    </span>
  );
}
