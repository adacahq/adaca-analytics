'use client';

import { ReactNode, createContext, useCallback, useContext, useState } from 'react';
import Modal from './Modal';
import Button from './Button';

interface ConfirmOptions {
  title?: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

/** Promise-based confirm — replaces window.confirm() with an on-brand modal. */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => setState({ opts, resolve }));
  }, []);

  function close(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  const opts = state?.opts;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={opts?.title ?? 'Confirm'}
        maxWidth={440}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => close(false)}>
              {opts?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              variant={opts?.danger ? 'danger' : 'primary'}
              size="sm"
              onClick={() => close(true)}
              autoFocus
            >
              {opts?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="text-[14px]" style={{ color: 'var(--fg)', lineHeight: 1.6 }}>
          {opts?.body ?? 'Are you sure?'}
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}
