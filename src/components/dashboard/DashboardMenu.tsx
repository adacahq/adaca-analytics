'use client';

import { useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import ShareModal from './ShareModal';
import { useConfirm } from '@/components/ui/Confirm';
import { usePanel } from '@/layouts/App/usePanel';
import { deleteDashboardAction, duplicateDashboardAction, renameDashboardAction, resetDashboardAction } from '@/lib/dashboard/actions';
import { dashboardHref } from '@/lib/nav';
import type { Dashboard, WidgetInstance } from '@/lib/dashboard/types';

/** The dashboard's overflow: reset to template, duplicate, share, rename, delete. */
export default function DashboardMenu({ dashboard, onReset }: { dashboard: Dashboard; onReset: (layout: WidgetInstance[]) => void }) {
  const pathname = usePathname() ?? '/';
  const confirm = useConfirm();
  const { ref, open, toggle, close } = usePanel<HTMLDivElement>(pathname);
  const [renaming, setRenaming] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [name, setName] = useState(dashboard.name);
  const [pending, startTransition] = useTransition();

  async function reset() {
    close();
    const ok = await confirm({
      title: `Reset ${dashboard.name}?`,
      body: 'The layout goes back to the built-in template. Widgets you added or changed here are lost.',
      confirmLabel: 'Reset to template',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await resetDashboardAction(dashboard.id);
      if (r.ok) {
        onReset(r.data.layout);
        toast.success('Dashboard reset');
      } else toast.error(r.error);
    });
  }

  function duplicate() {
    close();
    startTransition(async () => {
      const r = await duplicateDashboardAction(dashboard.id);
      if (r.ok) window.location.assign(dashboardHref(r.data.slug));
      else toast.error(r.error);
    });
  }

  function rename() {
    startTransition(async () => {
      const r = await renameDashboardAction(dashboard.id, name);
      if (r.ok) window.location.reload();
      else toast.error(r.error);
    });
  }

  async function remove() {
    close();
    const ok = await confirm({ title: `Delete ${dashboard.name}?`, body: 'This custom dashboard and its widgets are removed.', confirmLabel: 'Delete dashboard', danger: true });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteDashboardAction(dashboard.id);
      if (r.ok) window.location.assign('/');
      else toast.error(r.error);
    });
  }

  return (
    <div className="tbdrop" ref={ref}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={toggle} aria-expanded={open} aria-haspopup="menu" disabled={pending}>
        More
      </button>
      {open ? (
        <div className="tbpanel right" role="menu" style={{ minWidth: 200 }}>
          {dashboard.template_key ? (
            <button type="button" className="tbrow" role="menuitem" onClick={reset}>
              Reset to template
            </button>
          ) : null}
          <button type="button" className="tbrow" role="menuitem" onClick={duplicate}>
            Duplicate
          </button>
          <button
            type="button"
            className="tbrow"
            role="menuitem"
            onClick={() => {
              close();
              setSharing(true);
            }}
          >
            Share…
          </button>
          {dashboard.kind === 'custom' ? (
            <>
              <button
                type="button"
                className="tbrow"
                role="menuitem"
                onClick={() => {
                  close();
                  setName(dashboard.name);
                  setRenaming(true);
                }}
              >
                Rename
              </button>
              <span className="tbsep" aria-hidden />
              <button type="button" className="tbrow menu-row--danger" role="menuitem" onClick={remove}>
                Delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      <ShareModal open={sharing} onClose={() => setSharing(false)} dashboard={dashboard} />
      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Rename Dashboard"
        maxWidth={440}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={pending || !name.trim()} onClick={rename}>
              Save
            </button>
          </>
        }
      >
        <div className="field">
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
      </Modal>
    </div>
  );
}
