import { supabase } from './supabase';
import {
  getDirtyHabits,
  getDirtyHabitLogs,
  markHabitsSynced,
  markHabitLogsSynced,
  upsertHabitLocal,
  upsertHabitLogLocal,
  getSyncMeta,
  setSyncMeta,
} from './localDb';
import type { Habit, HabitLog } from '@/types/habit';

type HabitRow = {
  id: string;
  user_id: string | null;
  key: string;
  label: string;
  icon: string;
  unit: string | null;
  target_value: number | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

type HabitLogRow = {
  id: string;
  user_id: string | null;
  habit_id: string;
  log_date: string;
  value: number | null;
  mood_score: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function toHabitRow(h: Habit): HabitRow {
  return {
    id: h.id,
    user_id: h.userId,
    key: h.key,
    label: h.label,
    icon: h.icon,
    unit: h.unit,
    target_value: h.targetValue,
    archived: h.archived,
    created_at: h.createdAt,
    updated_at: h.updatedAt,
  };
}

function fromHabitRow(r: HabitRow): Habit {
  return {
    id: r.id,
    userId: r.user_id,
    key: r.key,
    label: r.label,
    icon: r.icon,
    unit: r.unit,
    targetValue: r.target_value,
    archived: r.archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toHabitLogRow(l: HabitLog): HabitLogRow {
  return {
    id: l.id,
    user_id: l.userId,
    habit_id: l.habitId,
    log_date: l.logDate,
    value: l.value,
    mood_score: l.moodScore,
    note: l.note,
    created_at: l.createdAt,
    updated_at: l.updatedAt,
  };
}

function fromHabitLogRow(r: HabitLogRow): HabitLog {
  return {
    id: r.id,
    userId: r.user_id,
    habitId: r.habit_id,
    logDate: r.log_date,
    value: r.value,
    moodScore: r.mood_score,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Pushes every locally-dirty row to Supabase. "Dirty" rows are only ever
 * created/edited on this device, so a plain upsert is safe — there's no
 * concurrent writer racing on the same row from this side. */
export async function pushLocalChanges(): Promise<void> {
  const dirtyHabits = await getDirtyHabits();
  if (dirtyHabits.length > 0) {
    const { error } = await supabase.from('habits').upsert(dirtyHabits.map(toHabitRow));
    if (!error) await markHabitsSynced(dirtyHabits.map((h) => h.id));
  }

  const dirtyLogs = await getDirtyHabitLogs();
  if (dirtyLogs.length > 0) {
    const { error } = await supabase.from('habit_logs').upsert(dirtyLogs.map(toHabitLogRow));
    if (!error) await markHabitLogsSynced(dirtyLogs.map((l) => l.id));
  }
}

/** Pulls anything changed on the server (by this or another device) since
 * the last successful pull, and applies it locally. Local upserts guard on
 * `updated_at` (see localDb.ts) so this can never clobber a newer local edit
 * that hasn't been pushed yet — simple last-write-wins conflict resolution,
 * which is enough for a single-user app where "conflicts" mostly mean
 * "edited on two devices before either synced," not concurrent writers. */
export async function pullRemoteChanges(userId: string): Promise<void> {
  const since = (await getSyncMeta('last_pulled_at')) ?? '1970-01-01T00:00:00Z';
  const pulledAt = new Date().toISOString();

  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', since);
  if (!habitsError) {
    for (const row of habits ?? []) await upsertHabitLocal(fromHabitRow(row as HabitRow), false);
  }

  const { data: logs, error: logsError } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', since);
  if (!logsError) {
    for (const row of logs ?? []) await upsertHabitLogLocal(fromHabitLogRow(row as HabitLogRow), false);
  }

  if (!habitsError && !logsError) await setSyncMeta('last_pulled_at', pulledAt);
}

export async function runSync(userId: string): Promise<void> {
  await pushLocalChanges();
  await pullRemoteChanges(userId);
}
