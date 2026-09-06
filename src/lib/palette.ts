/**
 * Chart palettes — the hue of the `--series` ramp every chart mark, share bar
 * and sparkline takes. Deployment-wide (stored in `settings.palette`) and
 * stamped as `data-palette` on the app's wrapper, where globals.css defines
 * each ramp. Pure; the settings page and the layouts both read it.
 */
export type PaletteKey = 'blue' | 'red' | 'yellow' | 'green' | 'orange' | 'purple';

export const PALETTES: { key: PaletteKey; label: string }[] = [
  { key: 'blue', label: 'Blue (default)' },
  { key: 'red', label: 'Red' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'green', label: 'Green' },
  { key: 'orange', label: 'Orange' },
  { key: 'purple', label: 'Purple' },
];

export const DEFAULT_PALETTE: PaletteKey = 'blue';

export function isPaletteKey(v: unknown): v is PaletteKey {
  return typeof v === 'string' && PALETTES.some((p) => p.key === v);
}

/** The stored value, or the default for anything unset or unknown. */
export function paletteOf(v: unknown): PaletteKey {
  return isPaletteKey(v) ? v : DEFAULT_PALETTE;
}
