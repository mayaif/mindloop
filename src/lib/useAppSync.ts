import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getCurrentUser } from './supabase';
import { ensureDefaultHabits } from './habits';
import { runSync } from './sync';
import { subscribeToRealtimeSync, type RealtimeSyncHandle } from './realtime';

export type AppSyncState = {
  userId: string | null;
  /** True once we've checked for a session and found none — the app should
   * route to Onboarding/auth. Never true again once a user signs in. */
  needsAuth: boolean;
  ready: boolean;
  syncing: boolean;
  /** True once the Realtime channel is subscribed — a live cross-device
   * connection is active, not just periodic reconnect-triggered syncs. */
  realtimeConnected: boolean;
  lastSyncedAt: Date | null;
  lastError: string | null;
  /** Call after a successful sign-in/sign-up/guest-start so the app picks up
   * the new session, seeds default habits if needed, and syncs. */
  onSignedIn: () => Promise<void>;
  /** Bump this after a local write so screens can force an immediate re-read
   * of local data without waiting on the sync/realtime cadence. */
  refreshToken: number;
};

/** Checks for an existing session on launch (never signs anyone in
 * implicitly — that's now a deliberate choice made on the Onboarding/auth
 * screen), seeds default habits, re-syncs whenever connectivity comes back,
 * and holds open a Realtime subscription so changes from another device
 * apply to local SQLite within a second or two while both are online. */
export function useAppSync(): AppSyncState {
  const [userId, setUserId] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const userIdRef = useRef<string | null>(null);
  const realtimeRef = useRef<RealtimeSyncHandle | null>(null);

  const bumpRefresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  const proceedWithUser = useCallback(
    async (id: string) => {
      userIdRef.current = id;
      setUserId(id);
      setNeedsAuth(false);
      await ensureDefaultHabits(id);
      setReady(true);
      void trySync(id);

      realtimeRef.current?.unsubscribe();
      realtimeRef.current = subscribeToRealtimeSync(id, bumpRefresh);
      setRealtimeConnected(true);
    },
    [bumpRefresh]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const user = await getCurrentUser();
        if (cancelled) return;
        if (user) {
          await proceedWithUser(user.id);
        } else {
          setNeedsAuth(true);
        }
      } catch (err) {
        if (!cancelled) setLastError(err instanceof Error ? err.message : 'Failed to check session');
      }
    })();

    return () => {
      cancelled = true;
      realtimeRef.current?.unsubscribe();
    };
  }, [proceedWithUser]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && userIdRef.current) {
        void trySync(userIdRef.current);
      }
    });
    return unsubscribe;
  }, []);

  async function trySync(id: string) {
    setSyncing(true);
    try {
      await runSync(id);
      setLastError(null);
      setLastSyncedAt(new Date());
      bumpRefresh();
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  const onSignedIn = useCallback(async () => {
    const user = await getCurrentUser();
    if (user) await proceedWithUser(user.id);
  }, [proceedWithUser]);

  return {
    userId,
    needsAuth,
    ready,
    syncing,
    realtimeConnected,
    lastSyncedAt,
    lastError,
    onSignedIn,
    refreshToken,
  };
}
