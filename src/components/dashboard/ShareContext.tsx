'use client';

import { createContext, useContext } from 'react';

/**
 * Set on a shared (read-only) dashboard: widgets then load through the
 * share's own API route instead of server actions, nothing drills (the
 * reader has no access to the rest of the app), and a locked period cannot
 * be narrowed by clicking a chart.
 */
export interface ShareInfo {
  token: string;
  locked: boolean;
}

const ShareContext = createContext<ShareInfo | null>(null);

export const ShareProvider = ShareContext.Provider;

export function useShare(): ShareInfo | null {
  return useContext(ShareContext);
}
