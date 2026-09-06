'use client';

import type { ReactNode } from 'react';

/**
 * Widget chrome: the `.chart-card` surface as a `.widget` (fills its grid
 * cell) with a `.chart-head` title row. In edit mode it shows the drag
 * handle (`.widget-drag`, the grid's drag selector) plus edit / copy / remove.
 */
export default function WidgetCard({
  title,
  caption,
  editing,
  onEdit,
  onDuplicate,
  onRemove,
  onMove,
  canMove = [true, true],
  seeAll,
  loading,
  error,
  children,
}: {
  title: string;
  caption?: string;
  editing: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  /** Small screens: move one step up or down the reading order instead of dragging. */
  onMove?: (dir: -1 | 1) => void;
  canMove?: [boolean, boolean];
  /** The explore page with every row and metric of this widget's data. */
  seeAll?: string | null;
  loading?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="chart-card widget">
      <div className="chart-head">
        <span className="flex min-w-0 items-center gap-2">
          {editing && (
            <span className="widget-drag shrink-0" title="Drag to move" style={{ cursor: 'grab', color: 'var(--muted)' }}>
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden>
                <path d="M1 1h10M1 7h10" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
          )}
          <span className="field-label truncate" style={{ margin: 0 }} title={title}>
            {title}
          </span>
          {caption ? <span className="micro truncate hidden sm:inline">{caption}</span> : null}
        </span>
        {!editing && seeAll ? (
          <a className="muted-link seeall" href={seeAll} title="Every row, every metric">
            See all
          </a>
        ) : null}
        {editing && (
          <span className="flex shrink-0 items-center gap-3">
            {onMove ? (
              <>
                <button type="button" className="muted-link wmove" title="Move up" aria-label="Move up" disabled={!canMove[0]} onClick={() => onMove(-1)}>
                  ↑
                </button>
                <button type="button" className="muted-link wmove" title="Move down" aria-label="Move down" disabled={!canMove[1]} onClick={() => onMove(1)}>
                  ↓
                </button>
              </>
            ) : null}
            <button type="button" className="muted-link" title="Configure" aria-label="Configure" onClick={onEdit}>
              Edit
            </button>
            <button type="button" className="muted-link" title="Duplicate" aria-label="Duplicate" onClick={onDuplicate}>
              Copy
            </button>
            <button type="button" className="muted-link" title="Remove" aria-label="Remove" onClick={onRemove}>
              ✕
            </button>
          </span>
        )}
      </div>
      <div className="wbody">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-[12px]" style={{ color: 'var(--muted)', minHeight: 60 }}>
            <span className="spinner" aria-hidden /> Loading
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-center text-[12px] px-3" style={{ color: 'var(--crit)', minHeight: 60 }}>
            {error}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
