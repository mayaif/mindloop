import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { isHealthKitSupported, requestHealthAuthorization, readTodayHealthSnapshot } from './health';
import { getHabitsLocal, getLogsForDateLocal, upsertHabitLogLocal } from './localDb';
import { todayIsoDate } from './habits';
import type { Habit, HabitLog, HabitKey } from '@/types/habit';

/** Habits whose value is sourced from HealthKit instead of manual entry.
 * Water and Mood have no reasonable automatic proxy and stay manual. */
const HEALTHKIT_HABIT_KEYS: HabitKey[] = ['exercise', 'sleep'];

export function isHealthSyncableHabit(key: string): boolean {
  return (HEALTHKIT_HABIT_KEYS as string[]).includes(key);
}

export async function isHealthSyncAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await isHealthKitSupported());
}

/** Requests HealthKit read authorization on every call rather than once —
 * Apple's system sheet only ever appears for types the user hasn't decided
 * on yet, so this is a cheap no-op once everything's been granted/denied,
 * and it's what makes adding or changing a read type (like the Steps vs.
 * Exercise Minutes swap) actually prompt existing installs instead of
 * silently reading nothing forever because a one-time local flag says
 * "already asked." Then pulls today's Steps and Sleep data in and writes it
 * to the local habit_logs rows those two habits already use — reusing the
 * exact same dirty-flag push-sync path a manual tap would go through, so it
 * reaches Supabase/other devices for free. Cheap and safe to call on every
 * ready/reconnect — a no-op on Android/web or when HealthKit hasn't granted
 * anything yet. */
export async function syncHealthDataForToday(userId: string): Promise<void> {
  if (!(await isHealthSyncAvailable())) return;

  await requestHealthAuthorization();

  const snapshot = await readTodayHealthSnapshot();
  const readings: Partial<Record<HabitKey, number | null>> = {
    exercise: snapshot.steps,
    sleep: snapshot.sleepHours,
  };

  const habits = await getHabitsLocal();
  const date = todayIsoDate();
  const logs = await getLogsForDateLocal(date);
  const nowIso = new Date().toISOString();

  for (const key of HEALTHKIT_HABIT_KEYS) {
    const value = readings[key];
    if (value === null || value === undefined) continue; // read failed / not granted — leave existing data alone

    const habit = habits.find((h: Habit) => h.key === key);
    if (!habit) continue;
    const existing = logs.find((l) => l.habitId === habit.id);

    // Don't let a `0` HealthKit reading stomp a manual entry made earlier
    // today — only overwrite when the existing row is itself a prior
    // HealthKit sync (a real re-sync) or there's a genuine positive reading.
    if (existing?.source === 'manual' && value === 0) continue;

    const log: HabitLog = existing
      ? { ...existing, value, source: 'healthkit', updatedAt: nowIso }
      : {
          id: Crypto.randomUUID(),
          userId,
          habitId: habit.id,
          logDate: date,
          value,
          moodScore: null,
          note: null,
          source: 'healthkit',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
    await upsertHabitLogLocal(log, true);
  }
}
