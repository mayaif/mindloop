import { Slot } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { AppSyncProvider, useAppSyncContext } from '@/lib/AppSyncContext';
import { Onboarding } from '@/components/Onboarding';
import { AppChrome } from '@/components/AppChrome';
import { configureNotificationHandler } from '@/lib/notifications';
import '../global.css';

// Module-level, not inside a component — this only needs to run once per
// process, and controls whether a notification that arrives while the app
// is already open gets shown at all (see lib/notifications.ts).
configureNotificationHandler();

function Gate() {
  const { needsAuth, ready, onSignedIn } = useAppSyncContext();

  if (needsAuth) {
    return <Onboarding onSignedIn={onSignedIn} />;
  }

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AppChrome>
      <Slot />
    </AppChrome>
  );
}

export default function RootLayout() {
  return (
    <AppSyncProvider>
      <Gate />
    </AppSyncProvider>
  );
}
