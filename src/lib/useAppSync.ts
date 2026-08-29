import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getCurrentUser } from './supabase';
import { ensureDefaultHabits } from './habits';
import { runSync } from './sync';

export type AppSyncState = {
  userId: string | null;
  /** True once we've checked for a session and found none — the app should
   * route to Onboarding/auth. Never true again once a user signs in. */
  needsAuth: boolean;
  ready: boolean;
  syncing: boolean;
  lastError: string | null;
  /** Call after a successful sign-in/sign-up/guest-start so the app picks up
   * the new session, seeds default habits if needed, and syncs. */
  onSignedIn: () => Promise<void>;
};

/** Checks for an existing session on launch (never signs anyone in
 * implicitly — that's now a deliberate choice made on the Onboarding/auth
 * screen), then seeds default habits and re-syncs whenever connectivity
 * comes back — the offline -> online transition a habit tracker needs to
 * handle constantly, not just once at startup. */
export function useAppSync(): AppSyncState {
  const [userId, setUserId] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const proceedWithUser = useCallback(async (id: string) => {
    userIdRef.current = id;
    setUserId(id);
    setNeedsAuth(false);
    await ensureDefaultHabits(id);
    setReady(true);
    void trySync(id);
  }, []);

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

  return { userId, needsAuth, ready, syncing, lastError, onSignedIn };
}
