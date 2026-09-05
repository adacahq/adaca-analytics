/**
 * SQL literal helpers for the one place this app builds SQL from data rather
 * than binding it: bulk rollup inserts. D1 caps bound parameters at 100 per
 * statement, which would mean 7 rows per statement and thousands of
 * statements per backfill unit; a 100 KB statement with literal values fits
 * ~500 rows. Every value passes through here — never interpolate raw.
 */

/** A SQL string literal: single quotes doubled, NULs stripped. */
export function lit(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  // SQLite treats a backslash as an ordinary character; only the quote needs doubling.
  return `'${value.replace(/\0/g, '').replace(/'/g, "''")}'`;
}

/** A SQL numeric literal; anything non-finite becomes 0. */
export function num(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

/** An identifier we control (table/column names from our own registries). */
export function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`Unsafe identifier: ${name}`);
  return name;
}
