import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSyncContext } from '@/lib/AppSyncContext';
import { getHabitsLocal, getLogsForDateLocal } from '@/lib/localDb';
import { adjustTodayProgress, setTodayMood, todayIsoDate } from '@/lib/habits';
import { StatTile } from '@/components/StatTile';
import { HabitRow } from '@/components/HabitRow';
import type { Habit, HabitLog } from '@/types/habit';

// HealthKit only exists on iOS — everywhere else, Sleep/Steps stay
// manually-entered, so we surface a note pointing at the phone app instead
// of silently doing nothing.
const SHOW_HEALTH_FALLBACK_NOTE = Platform.OS !== 'ios';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const { userId, refreshToken, ready } = useAppSyncContext();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [h, l] = await Promise.all([getHabitsLocal(), getLogsForDateLocal(todayIsoDate())]);
    setHabits(h);
    setLogs(l);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, refreshToken, load]);

  async function handleAdjust(habit: Habit, delta: number) {
    if (!userId) return;
    await adjustTodayProgress(userId, habit, delta);
    await load();
  }

  async function handleMood(habit: Habit, score: number) {
    if (!userId) return;
    await setTodayMood(userId, habit, score);
    await load();
  }

  function logFor(habitId: string) {
    return logs.find((l) => l.habitId === habitId);
  }

  const primaryHabits = habits.filter((h) => ['water', 'sleep', 'exercise', 'mood'].includes(h.key));

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 p-6" accessibilityLabel="Today">
        <View className="gap-1">
          <Text accessibilityRole="header" className="text-3xl font-semibold text-foreground">{greeting()}</Text>
          <Text className="text-base text-muted-foreground">Ready to center yourself today?</Text>
        </View>

        <View>
          <Text className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Daily overview
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {primaryHabits.map((habit) => {
              const log = logFor(habit.id);
              const valueLabel =
                habit.key === 'mood'
                  ? log?.moodScore
                    ? `${log.moodScore}/5`
                    : 'Not logged'
                  : `${log?.value ?? 0}${habit.unit ? ` ${habit.unit}` : ''}`;
              return (
                <View key={habit.id} className="w-[48%]">
                  <StatTile icon={habit.icon} label={habit.label} valueLabel={valueLabel} />
                </View>
              );
            })}
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Today&apos;s habits
          </Text>
          {SHOW_HEALTH_FALLBACK_NOTE && (
            <Text className="text-xs text-muted-foreground">
              Sleep and Steps sync automatically from Apple Health on iPhone — log them here manually for now.
            </Text>
          )}
          {habits.map((habit) => {
            const log = logFor(habit.id);
            return (
              <HabitRow
                key={habit.id}
                habit={habit}
                value={log?.value ?? null}
                moodScore={log?.moodScore ?? null}
                source={log?.source}
                onAdjust={(delta) => handleAdjust(habit, delta)}
                onSetMood={(score) => handleMood(habit, score)}
              />
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
