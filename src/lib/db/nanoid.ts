const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * A 10-character lowercase alphanumeric id (36^10 ≈ 3.6e15). Every config
 * row's primary key, generated app-side because SQLite has no nanoid().
 * Uses WebCrypto, which exists in workerd, Node 22 and browsers alike.
 */
export function nanoid(size = 10): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
