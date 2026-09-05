/** Pure encoding helpers for the JWT flow — unit-tested, no Workers APIs. */

export function base64url(input: string | ArrayBuffer | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** PEM (PKCS#8 "PRIVATE KEY") → DER bytes for WebCrypto's importKey. */
export function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
