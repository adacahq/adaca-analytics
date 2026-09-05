import { describe, expect, it } from 'vitest';
import { activeGroupAndSection, dashboardHref, navGroups, viewOn } from './nav';

const groups = navGroups([
  { slug: 'home', name: 'Home', kind: 'default' },
  { slug: 'realtime', name: 'Realtime', kind: 'default' },
  { slug: 'abc123', name: 'Board', kind: 'custom' },
]);

describe('nav', () => {
  it('routes home to / and everything else under /d/', () => {
    expect(dashboardHref('home')).toBe('/');
    expect(dashboardHref('realtime')).toBe('/d/realtime');
  });

  it('matches views by boundary-aware prefix', () => {
    expect(viewOn({ href: '/d/home', label: 'x' }, '/d/home-2')).toBe(false);
    expect(viewOn({ href: '/d/abc123', label: 'x' }, '/d/abc123/edit')).toBe(true);
    expect(viewOn({ href: '/', label: 'x', exact: true }, '/d/realtime')).toBe(false);
  });

  it('finds the active group and section', () => {
    expect(activeGroupAndSection(groups, '/')?.section.key).toBe('home');
    expect(activeGroupAndSection(groups, '/d/abc123')?.group.key).toBe('custom');
    expect(activeGroupAndSection(groups, '/settings/ingestion')?.view?.label).toBe('Ingestion');
    expect(activeGroupAndSection(groups, '/setup')).toBeNull();
  });

  it('keeps the Custom group even when empty, with its add action', () => {
    const g = navGroups([]).find((x) => x.key === 'custom');
    expect(g?.sections).toHaveLength(0);
    expect(g?.add?.href).toBe('/d/new');
  });
});
