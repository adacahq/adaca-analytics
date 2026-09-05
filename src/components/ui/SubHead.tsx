import type { CSSProperties, ReactNode } from 'react';

/** The head of one tab's content: an h2, an optional right-aligned action,
 *  and an optional lede. Sits UNDER a tab tray whose container header (the
 *  `.eyebrow` → `.view-title` macro) is rendered once by the layout above.
 *  `i` is the reveal stagger index of the title row; the lede takes `i + 1`.
 *  Default 2 continues the admin layout's 0/1 (title/tabs). */
export default function SubHead({ title, action, children, i = 2 }: {
  title: string; action?: ReactNode; children?: ReactNode; i?: number;
}) {
  return (
    <>
      <div className="subhead rv" style={{ '--i': i } as CSSProperties}>
        <h2 className="sub-title">{title}</h2>
        {action && <span className="flex items-center gap-3">{action}</span>}
      </div>
      {children && (
        <p className="lede rv" style={{ '--i': i + 1 } as CSSProperties}>{children}</p>
      )}
    </>
  );
}
