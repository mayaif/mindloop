import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSyncContext } from '@/lib/AppSyncContext';

const NAV_ITEMS = [
  { href: '/', label: 'Today', icon: 'home' as const },
  { href: '/trends', label: 'Trends', icon: 'bar-chart-2' as const },
  { href: '/coach', label: 'Coach', icon: 'message-circle' as const },
  { href: '/settings', label: 'Settings', icon: 'settings' as const },
] as const;

const DESKTOP_BREAKPOINT = 768;

function SyncStatus({ compact = false }: { compact?: boolean }) {
  const { syncing, realtimeConnected, lastSyncedAt } = useAppSyncContext();
  const label = syncing
    ? 'Syncing…'
    : realtimeConnected
      ? 'Live'
      : lastSyncedAt
        ? `Synced ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Offline';
  return (
    <View className="flex-row items-center gap-1.5" accessibilityLabel={`Sync status: ${label}`}>
      <View className={`h-2 w-2 rounded-full ${realtimeConnected ? 'bg-primary' : 'bg-muted-foreground'}`} />
      {!compact && <Text className="text-xs text-muted-foreground">{label}</Text>}
    </View>
  );
}

function NavIcon({ name, active }: { name: keyof typeof Feather.glyphMap; active: boolean }) {
  return <Feather name={name} size={22} color={active ? '#3F5C43' : '#6B7268'} />;
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  if (isDesktop) {
    return (
      <View className="flex-1 flex-row bg-background">
        <View className="w-60 border-r border-border px-4 py-6">
          <Text className="mb-8 px-2 text-xl font-semibold text-foreground">MindLoop</Text>
          <View className="gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} asChild>
                  <Pressable
                    accessibilityRole="link"
                    className={`flex-row items-center gap-3 rounded-lg px-3 py-2.5 ${active ? 'bg-primary/10' : ''}`}
                  >
                    <NavIcon name={item.icon} active={active} />
                    <Text className={active ? 'font-medium text-primary' : 'text-foreground'}>{item.label}</Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
          <View className="mt-auto flex-row items-center gap-2 px-3 pt-6">
            <SyncStatus />
          </View>
        </View>
        <View className="flex-1">{children}</View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">{children}</View>
      <SafeAreaView edges={['bottom']} className="border-t border-border bg-card">
        <View className="flex-row justify-around py-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable accessibilityRole="link" className="items-center gap-1 px-3 py-1.5">
                  <NavIcon name={item.icon} active={active} />
                  <Text className={`text-xs ${active ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                    {item.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

export { SyncStatus };
