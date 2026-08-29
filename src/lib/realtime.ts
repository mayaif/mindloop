import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { upsertHabitLocal, upsertHabitLogLocal } from './localDb';
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

export type RealtimeSyncHandle = { channel: RealtimeChannel; unsubscribe: () => void };

/** Subscribes to Postgres changes on this user's rows and applies them
 * straight to local SQLite as they arrive — this is what makes a change on
 * one device show up on another within a second or two while both are
 * online, rather than waiting for the next reconnect-triggered pull in
 * sync.ts. The row payload Realtime sends already has the full new row, so
 * this upserts it directly instead of re-fetching (dirty=false, since it
 * came from the server and doesn't need pushing back). */
export function subscribeToRealtimeSync(
  userId: string,
  onChange: () => void
): RealtimeSyncHandle {
  const channel = supabase
    .channel(`mindloop-sync-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') return; // no local delete path yet
        void upsertHabitLocal(fromHabitRow(payload.new as HabitRow), false).then(onChange);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'habit_logs', filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') return;
        void upsertHabitLogLocal(fromHabitLogRow(payload.new as HabitLogRow), false).then(onChange);
      }
    )
    .subscribe();

  return {
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}
