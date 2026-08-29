import * as Crypto from 'expo-crypto';
import { getHabitsLocal, upsertHabitLocal, getLogsForDateLocal, upsertHabitLogLocal } from './localDb';
import { DEFAULT_HABITS } from '@/types/habit';
import type { Habit, HabitLog } from '@/types/habit';

function nowIso() {
  return new Date().toISOString();
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Seeds the default habit set locally on first launch — a no-op if habits
 * already exist. Seeded rows are marked dirty so the next sync pushes them
 * up to Supabase too. */
export async function ensureDefaultHabits(userId: string): Promise<Habit[]> {
  const existing = await getHabitsLocal();
  if (existing.length > 0) return existing;

  const created: Habit[] = [];
  for (const def of DEFAULT_HABITS) {
    const habit: Habit = {
      id: Crypto.randomUUID(),
      userId,
      key: def.key,
      label: def.label,
      icon: def.icon,
      unit: def.unit,
      targetValue: def.targetValue,
      archived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await upsertHabitLocal(habit, true);
    created.push(habit);
  }
  return created;
}

/** Adds `delta` to today's logged value for a habit (creating today's row if
 * it doesn't exist yet) — the "+"/"-" stepper interaction from the Habit
 * Details screen. */
export async function adjustTodayProgress(userId: string, habit: Habit, delta: number): Promise<HabitLog> {
  const date = todayIsoDate();
  const logs = await getLogsForDateLocal(date);
  const existing = logs.find((l) => l.habitId === habit.id);

  const log: HabitLog = existing
    ? { ...existing, value: Math.max(0, (existing.value ?? 0) + delta), updatedAt: nowIso() }
    : {
        id: Crypto.randomUUID(),
        userId,
        habitId: habit.id,
        logDate: date,
        value: Math.max(0, delta),
        moodScore: null,
        note: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

  await upsertHabitLogLocal(log, true);
  return log;
}

/** Sets today's mood (1-5) — a direct set rather than an increment, since
 * mood is a single daily rating, not an accumulating count. */
export async function setTodayMood(userId: string, habit: Habit, moodScore: number): Promise<HabitLog> {
  const date = todayIsoDate();
  const logs = await getLogsForDateLocal(date);
  const existing = logs.find((l) => l.habitId === habit.id);

  const log: HabitLog = existing
    ? { ...existing, moodScore, updatedAt: nowIso() }
    : {
        id: Crypto.randomUUID(),
        userId,
        habitId: habit.id,
        logDate: date,
        value: null,
        moodScore,
        note: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

  await upsertHabitLogLocal(log, true);
  return log;
}

export async function getTodaysLogs(): Promise<HabitLog[]> {
  return getLogsForDateLocal(todayIsoDate());
}
