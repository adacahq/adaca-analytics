/**
 * The navigation hierarchy, in one place. The sidebar renders the group/
 * section tree and the topbar names the current section — both read this
 * tree, so they can never drift apart.
 *
 * Pure data + pure functions only — no 'use client' — so this is importable
 * from both the server layout (which builds the dashboard groups from D1)
 * and the client shell (sidebar, topbar).
 */

export interface NavView {
  href: string;
  label: string;
  /** Match the pathname exactly (for `/`) rather than by prefix. */
  exact?: boolean;
}

export interface NavSection {
  key: string;
  label: string;
  views: NavView[];
}

export interface NavGroup {
  key: string;
  /** Omitted for the top, unlabelled group. */
  label?: string;
  sections: NavSection[];
  /** Rendered last, pinned to the bottom of the rail. */
  footer?: boolean;
  /** The group's trailing "+" quick action (Custom → New dashboard). */
  add?: { href: string; label: string };
}

export interface DashboardLink {
  slug: string;
  name: string;
  kind: 'default' | 'custom';
}

export function dashboardHref(slug: string): string {
  return slug === 'home' ? '/' : `/d/${slug}`;
}

/** The nav tree: the default dashboards, the custom ones, and Settings. */
export function navGroups(dashboards: DashboardLink[]): NavGroup[] {
  const defaults = dashboards.filter((d) => d.kind === 'default');
  const customs = dashboards.filter((d) => d.kind === 'custom');
  return [
    {
      key: 'dashboards',
      label: 'Dashboards',
      sections: defaults.map((d) => ({
        key: d.slug,
        label: d.name,
        views: [{ href: dashboardHref(d.slug), label: d.name, exact: d.slug === 'home' }],
      })),
    },
    {
      key: 'custom',
      label: 'Custom',
      add: { href: '/d/new', label: 'New dashboard' },
      sections: customs.map((d) => ({
        key: d.slug,
        label: d.name,
        views: [{ href: dashboardHref(d.slug), label: d.name }],
      })),
    },
    {
      key: 'settings',
      label: 'Settings',
      footer: true,
      sections: [
        {
          key: 'settings',
          label: 'Settings',
          views: [
            { href: '/settings/sites', label: 'Sites' },
            { href: '/settings/ingestion', label: 'Ingestion' },
            { href: '/settings/reports', label: 'Reports' },
            { href: '/settings/appearance', label: 'Appearance' },
            { href: '/settings/about', label: 'About' },
          ],
        },
      ],
    },
  ];
}

/** Prefix matching is boundary-aware: `/d/home` must not light up for `/d/home-2`. */
export function viewOn(view: NavView, pathname: string): boolean {
  if (view.exact) return pathname === view.href;
  return pathname === view.href || pathname.startsWith(`${view.href}/`);
}

export function sectionOn(section: NavSection, pathname: string): boolean {
  return section.views.some((v) => viewOn(v, pathname));
}

/** Where the topbar's position readout points. Null for a path that matches
 *  nothing in the tree (e.g. `/setup`) rather than throwing. */
export function activeGroupAndSection(
  groups: NavGroup[],
  pathname: string,
): { group: NavGroup; section: NavSection; view: NavView | null } | null {
  for (const group of groups) {
    for (const section of group.sections) {
      if (!sectionOn(section, pathname)) continue;
      const view = section.views.find((v) => viewOn(v, pathname)) ?? null;
      return { group, section, view };
    }
  }
  return null;
}
