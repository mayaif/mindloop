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
  if (existing.length > 0) {
    await migrateExerciseHabitToSteps(existing);
    return existing;
  }

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

/** One-time fixup for installs seeded before the Exercise habit was
 * redefined from "Exercise Minutes" (needs an Apple Watch workout or a
 * manual Health entry) to "Steps" (populated automatically just by
 * carrying an iPhone). Only touches a row that still has the old
 * minutes/30 shape, so it's a no-op everywhere else. */
async function migrateExerciseHabitToSteps(existing: Habit[]): Promise<void> {
  const stepsDef = DEFAULT_HABITS.find((d) => d.key === 'exercise');
  if (!stepsDef) return;
  const stale = existing.find((h) => h.key === 'exercise' && h.unit !== stepsDef.unit);
  if (!stale) return;

  await upsertHabitLocal(
    { ...stale, label: stepsDef.label, unit: stepsDef.unit, targetValue: stepsDef.targetValue, updatedAt: nowIso() },
    true
  );
}

/** Adds `delta` to today's logged value for a habit (creating today's row if
 * it doesn't exist yet) — the "+"/"-" stepper interaction from the Habit
 * Details screen. */
export async function adjustTodayProgress(userId: string, habit: Habit, delta: number): Promise<HabitLog> {
  const date = todayIsoDate();
  const logs = await getLogsForDateLocal(date);
  const existing = logs.find((l) => l.habitId === habit.id);

  const log: HabitLog = existing
    ? { ...existing, value: Math.max(0, (existing.value ?? 0) + delta), source: 'manual', updatedAt: nowIso() }
    : {
        id: Crypto.randomUUID(),
        userId,
        habitId: habit.id,
        logDate: date,
        value: Math.max(0, delta),
        moodScore: null,
        note: null,
        source: 'manual',
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
    ? { ...existing, moodScore, source: 'manual', updatedAt: nowIso() }
    : {
        id: Crypto.randomUUID(),
        userId,
        habitId: habit.id,
        logDate: date,
        value: null,
        moodScore,
        note: null,
        source: 'manual',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

  await upsertHabitLogLocal(log, true);
  return log;
}

export async function getTodaysLogs(): Promise<HabitLog[]> {
  return getLogsForDateLocal(todayIsoDate());
}
