import { describe, expect, it } from 'vitest';
import { isOpenPath } from './gate';

describe('the gate', () => {
  it('opens health, robots and the static marks', () => {
    for (const p of ['/api/health', '/robots.txt', '/favicon.ico', '/favicon.png', '/apple-touch-icon.png', '/logo.svg', '/logo-white.svg']) expect(isOpenPath(p, 'GET'), p).toBe(true);
  });

  it('opens shared dashboards, their assets and their data route for reading only', () => {
    expect(isOpenPath('/share/abc123', 'GET')).toBe(true);
    expect(isOpenPath('/share/abc123', 'HEAD')).toBe(true);
    expect(isOpenPath('/_next/static/chunk.js', 'GET')).toBe(true);
    expect(isOpenPath('/api/share/abc123/widget?id=x', 'GET')).toBe(true);
    // A POST to the page is how a server action would be invoked: gated.
    expect(isOpenPath('/share/abc123', 'POST')).toBe(false);
    expect(isOpenPath('/_next/static/chunk.js', 'POST')).toBe(false);
  });

  it('gates everything else', () => {
    for (const p of ['/', '/d/acquisition', '/detail/page/%2F', '/explore/content.pages', '/settings/sites', '/api/ingest/advance', '/sharex', '/shares/1']) expect(isOpenPath(p, 'GET'), p).toBe(false);
  });
});
