import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, Platform, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { getCurrentUser, upgradeGuestToEmailAccount, signOut, type AuthUser } from '@/lib/supabase';
import { Card } from '@/components/Card';
import { SyncStatus } from '@/components/AppChrome';
import { useAppSyncContext } from '@/lib/AppSyncContext';
import { isHealthSyncAvailable } from '@/lib/healthSync';
import {
  isNotificationsSupported,
  getReminderPreference,
  enableReminder,
  disableReminder,
  REMINDER_PRESETS,
} from '@/lib/notifications';
import { colors } from '@/theme/colors';

export default function SettingsScreen() {
  const { lastSyncedAt, syncing, syncNow } = useAppSyncContext();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgraded, setUpgraded] = useState(false);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState<{ hour: number; minute: number }>({
    hour: REMINDER_PRESETS[2].hour,
    minute: REMINDER_PRESETS[2].minute,
  });
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);

  useEffect(() => {
    void getCurrentUser().then(setUser);
    void isHealthSyncAvailable().then(setHealthAvailable);
    void getReminderPreference().then((pref) => {
      setReminderEnabled(pref.enabled);
      setReminderTime({ hour: pref.hour, minute: pref.minute });
    });
  }, []);

  async function handleToggleReminder(next: boolean) {
    setReminderError(null);
    setReminderBusy(true);
    try {
      if (next) {
        const granted = await enableReminder(reminderTime.hour, reminderTime.minute);
        if (!granted) {
          setReminderError('Notifications permission was denied — enable it in your device Settings to get reminders.');
          setReminderBusy(false);
          return;
        }
      } else {
        await disableReminder();
      }
      setReminderEnabled(next);
    } finally {
      setReminderBusy(false);
    }
  }

  async function handlePickPreset(hour: number, minute: number) {
    setReminderTime({ hour, minute });
    if (!reminderEnabled) return; // just remembering the choice for next enable
    setReminderBusy(true);
    setReminderError(null);
    try {
      const granted = await enableReminder(hour, minute);
      if (!granted) setReminderError('Notifications permission was denied — enable it in your device Settings to get reminders.');
    } finally {
      setReminderBusy(false);
    }
  }

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const updated = await upgradeGuestToEmailAccount(email, password);
      setUser(updated);
      setUpgraded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create an account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 p-6" accessibilityLabel="Settings">
        <Text className="text-2xl font-semibold text-foreground">Settings</Text>

        <Card>
          <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</Text>
          {user?.isAnonymous ? (
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <View className="rounded-full bg-muted px-2 py-0.5">
                  <Text className="text-xs font-medium text-muted-foreground">Guest</Text>
                </View>
              </View>
              <Text className="mt-1 text-sm text-muted-foreground">
                Your data is saved on this device and synced to the cloud, but only recoverable here
                unless you create an account.
              </Text>
            </View>
          ) : (
            <Text className="text-foreground">{user?.email}</Text>
          )}
        </Card>

        {user?.isAnonymous && !upgraded && (
          <Card>
            <Text className="mb-3 font-semibold text-foreground">Create an account</Text>
            <View className="gap-3">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                accessibilityLabel="Email"
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-foreground"
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry
                accessibilityLabel="Password"
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-foreground"
              />
              {error && (
                <Text accessibilityRole="alert" className="text-sm text-red-600">
                  {error}
                </Text>
              )}
              <Pressable
                onPress={handleUpgrade}
                disabled={loading || !email || !password}
                accessibilityRole="button"
                className="items-center rounded-xl bg-primary py-3"
              >
                {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text className="font-medium text-primary-foreground">Save</Text>}
              </Pressable>
            </View>
          </Card>
        )}

        {upgraded && (
          <Text className="text-sm text-muted-foreground">
            Account created — check your email to confirm, then you can log in from any device.
          </Text>
        )}

        <Card>
          <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Apple Health</Text>
          {healthAvailable ? (
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <Feather name="heart" size={16} color={colors.primary} />
                <Text className="text-sm text-foreground">Sleep and Steps sync automatically from Health.</Text>
              </View>
              <Pressable
                onPress={() => void syncNow()}
                disabled={syncing}
                accessibilityRole="button"
                className="items-center rounded-xl border border-border py-2.5"
              >
                {syncing ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="font-medium text-foreground">Sync now</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Text className="text-sm text-muted-foreground">
              {Platform.OS === 'ios'
                ? 'Health data isn’t available on this device.'
                : 'Use the app on your iPhone to sync Sleep and Steps from Apple Health automatically.'}
            </Text>
          )}
        </Card>

        <Card>
          <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Reminders</Text>
          {isNotificationsSupported() ? (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-foreground">Daily check-in reminder</Text>
                <Switch
                  value={reminderEnabled}
                  onValueChange={(v) => void handleToggleReminder(v)}
                  disabled={reminderBusy}
                  accessibilityLabel="Daily check-in reminder"
                  trackColor={{ true: colors.primary }}
                />
              </View>
              <View className="flex-row gap-2">
                {REMINDER_PRESETS.map((preset) => {
                  const selected = reminderTime.hour === preset.hour && reminderTime.minute === preset.minute;
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => void handlePickPreset(preset.hour, preset.minute)}
                      disabled={reminderBusy}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      className={`flex-1 items-center rounded-full py-2 ${selected ? 'bg-primary' : 'border border-border'}`}
                    >
                      <Text className={`text-sm font-medium ${selected ? 'text-primary-foreground' : 'text-foreground'}`}>
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {reminderError && (
                <Text accessibilityRole="alert" className="text-sm text-red-600">
                  {reminderError}
                </Text>
              )}
            </View>
          ) : (
            <Text className="text-sm text-muted-foreground">Reminders are available in the mobile app.</Text>
          )}
        </Card>

        <Card>
          <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sync</Text>
          <View className="flex-row items-center justify-between">
            <SyncStatus />
            {lastSyncedAt && (
              <Text className="text-xs text-muted-foreground">
                Last synced {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>
        </Card>

        <Pressable
          onPress={() => void signOut()}
          accessibilityRole="button"
          className="items-center rounded-xl border border-border py-3"
        >
          <Text className="font-medium text-foreground">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
