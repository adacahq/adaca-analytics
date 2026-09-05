import Link from 'next/link';
import type { ComponentType, ReactNode, SVGProps } from 'react';

export interface EmptyStateAction {
  label: string;
  href: string;
}

/**
 * On-brand empty state: the `.empty` dashed panel, a mono eyebrow, a
 * headline, an optional line of guidance, and a primary action. `icon` is
 * accepted for API compatibility with existing callers but no longer
 * rendered — the framed icon and the `.canvas-grid` panel are gone under
 * Canvas; `.empty`'s dashed hairline carries the whole treatment now.
 * `actionSlot` renders in place of `action` for callers whose primary action
 * opens a modal rather than navigating (e.g. `NewNodeButton`).
 */
export default function EmptyState({
  eyebrow = 'Empty',
  title,
  description,
  action,
  actionSlot,
}: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  actionSlot?: ReactNode;
}) {
  return (
    <div className="empty my-4">
      <span className="zone-label">{eyebrow}</span>
      <h3 className="mt-3.5" style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--fg)' }}>
        {title}
      </h3>
      {description && <p>{description}</p>}
      {actionSlot ? (
        <div className="mt-5">{actionSlot}</div>
      ) : (
        action && (
          <Link href={action.href} className="btn btn-primary btn-sm mt-5">
            + {action.label}
          </Link>
        )
      )}
    </div>
  );
}
