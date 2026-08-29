import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. Copy .env.example to .env and fill them in.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase's recommendation for React Native: pause/resume the auth
// auto-refresh timer based on app foreground state, since RN apps don't get
// a browser tab lifecycle to key off of.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export type AuthUser = { id: string; email: string | null; isAnonymous: boolean };

function toAuthUser(user: { id: string; email?: string | null; is_anonymous?: boolean }): AuthUser {
  return { id: user.id, email: user.email ?? null, isAnonymous: Boolean(user.is_anonymous) };
}

/** Returns the current session's user if one is already persisted (from a
 * previous launch), or null if the app needs to show the Onboarding/auth
 * screen — this never signs anyone in implicitly, since "guest" is now a
 * deliberate user choice (see signInAsGuest), not an automatic default. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ? toAuthUser(data.session.user) : null;
}

/** "Continue as guest" — an anonymous identity, same as before, just no
 * longer triggered automatically. Its data carries over for free if the
 * guest later creates a real account (see upgradeGuestToEmailAccount),
 * since the user_id never changes. */
export async function signInAsGuest(): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(`Failed to start a guest session: ${error?.message ?? 'unknown error'}`);
  }
  return toAuthUser(data.user);
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Sign up failed');
  }
  return toAuthUser(data.user);
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Sign in failed');
  }
  return toAuthUser(data.user);
}

/** Converts the current guest session into a real account with the same
 * user_id — every habit/log already synced under the guest identity stays
 * attached, nothing to migrate. Supabase's documented pattern for exactly
 * this: call updateUser() while signed in anonymously. */
export async function upgradeGuestToEmailAccount(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await supabase.auth.updateUser({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Could not create an account from this guest session');
  }
  return toAuthUser(data.user);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
