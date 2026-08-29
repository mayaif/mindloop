import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSyncContext } from '@/lib/AppSyncContext';
import { getHabitsLocal, getRecentLogsLocal } from '@/lib/localDb';
import { Card } from '@/components/Card';
import { WeeklyBarChart } from '@/components/WeeklyBarChart';
import type { Habit, HabitLog } from '@/types/habit';

const MOOD_EMOJI = ['😞', '🙁', '😐', '🙂', '😄'];

function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export default function TrendsScreen() {
  const { refreshToken, ready } = useAppSyncContext();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const days = lastNDays(7);

  const load = useCallback(async () => {
    const [h, l] = await Promise.all([getHabitsLocal(), getRecentLogsLocal(days[0] as string)]);
    setHabits(h);
    setLogs(l);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, refreshToken, load]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-4 p-6" accessibilityLabel="Trends">
        <View className="gap-1">
          <Text className="text-2xl font-semibold text-foreground">Week at a Glance</Text>
          <Text className="text-muted-foreground">Here is your progress over the last 7 days.</Text>
        </View>

        {habits.map((habit) => {
          const habitLogs = logs.filter((l) => l.habitId === habit.id);

          if (habit.key === 'mood') {
            return (
              <Card key={habit.id}>
                <Text className="mb-3 font-semibold text-foreground">{habit.label}</Text>
                <View className="flex-row justify-between">
                  {days.map((date) => {
                    const entry = habitLogs.find((l) => l.logDate === date);
                    return (
                      <View key={date} className="items-center gap-1">
                        <Text className="text-lg">{entry?.moodScore ? MOOD_EMOJI[entry.moodScore - 1] : '·'}</Text>
                        <Text className="text-[10px] text-muted-foreground">
                          {new Date(date).toLocaleDateString(undefined, { weekday: 'narrow' })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card>
            );
          }

          const dayValues = days.map((date) => ({
            date,
            value: habitLogs.find((l) => l.logDate === date)?.value ?? 0,
          }));

          return (
            <Card key={habit.id}>
              <Text className="mb-3 font-semibold text-foreground">{habit.label}</Text>
              <WeeklyBarChart days={dayValues} target={habit.targetValue} />
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
