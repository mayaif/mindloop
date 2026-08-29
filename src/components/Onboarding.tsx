import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { signInAsGuest, signUpWithEmail, signInWithEmail } from '@/lib/supabase';

type Mode = 'choice' | 'signup' | 'login';

export function Onboarding({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [mode, setMode] = useState<Mode>('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setLoading(true);
    setError(null);
    try {
      await action();
      await onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="w-full max-w-sm gap-6">
        <View className="items-center gap-2">
          <Text className="text-3xl font-semibold text-foreground">MindLoop</Text>
          <Text className="text-center text-base text-muted-foreground">
            A gentle habit tracker with an AI coach that reviews your week and suggests small,
            achievable goals.
          </Text>
        </View>

        {mode === 'choice' && (
          <View className="gap-3">
            <Pressable
              className="items-center rounded-xl bg-primary py-3.5 active:opacity-90"
              disabled={loading}
              accessibilityRole="button"
              onPress={() => run(signInAsGuest)}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-medium text-primary-foreground">Continue as guest</Text>
              )}
            </Pressable>
            <Pressable
              className="items-center rounded-xl border border-border py-3.5 active:opacity-70"
              accessibilityRole="button"
              onPress={() => setMode('signup')}
            >
              <Text className="font-medium text-foreground">Create an account</Text>
            </Pressable>
            <Pressable
              className="items-center py-2"
              accessibilityRole="button"
              onPress={() => setMode('login')}
            >
              <Text className="text-sm text-muted-foreground">
                Already have an account? <Text className="text-primary">Log in</Text>
              </Text>
            </Pressable>
          </View>
        )}

        {(mode === 'signup' || mode === 'login') && (
          <View className="gap-3">
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                accessibilityLabel="Email"
                className="rounded-lg border border-border bg-card px-3 py-2.5 text-foreground"
              />
            </View>
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                accessibilityLabel="Password"
                className="rounded-lg border border-border bg-card px-3 py-2.5 text-foreground"
              />
            </View>

            {error && (
              <Text accessibilityRole="alert" className="text-sm text-red-600">
                {error}
              </Text>
            )}

            <Pressable
              className="items-center rounded-xl bg-primary py-3.5 active:opacity-90"
              disabled={loading || !email || !password}
              accessibilityRole="button"
              onPress={() =>
                run(() => (mode === 'signup' ? signUpWithEmail(email, password) : signInWithEmail(email, password)))
              }
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-medium text-primary-foreground">
                  {mode === 'signup' ? 'Create account' : 'Log in'}
                </Text>
              )}
            </Pressable>
            <Pressable className="items-center py-2" accessibilityRole="button" onPress={() => setMode('choice')}>
              <Text className="text-sm text-muted-foreground">Back</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
