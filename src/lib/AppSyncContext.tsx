import { createContext, useContext } from 'react';
import { useAppSync, type AppSyncState } from './useAppSync';

const AppSyncContext = createContext<AppSyncState | null>(null);

export function AppSyncProvider({ children }: { children: React.ReactNode }) {
  const state = useAppSync();
  return <AppSyncContext.Provider value={state}>{children}</AppSyncContext.Provider>;
}

/** Every screen needs userId (to scope local queries — mostly unused since
 * local SQLite is already per-device, but useful for the coach call) and
 * refreshToken (bumped after every sync/realtime event, so a screen's
 * useEffect can depend on it to know when to re-read local data). */
export function useAppSyncContext(): AppSyncState {
  const ctx = useContext(AppSyncContext);
  if (!ctx) throw new Error('useAppSyncContext must be used within AppSyncProvider');
  return ctx;
}
