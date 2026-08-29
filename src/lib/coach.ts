import { supabase } from './supabase';
import { getHabitsLocal, getRecentLogsLocal } from './localDb';

export type MicroGoal = {
  habitKey: string;
  title: string;
  description: string;
  action: 'commit' | 'review';
};

export type WeeklyCoachResult = { review: string; goals: MicroGoal[] };

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Gathers the last 7 days of local logs, invokes the weekly-coach Edge
 * Function (the only place the Groq key exists — see
 * supabase/functions/weekly-coach), and returns the review + micro-goals.
 * The Supabase client attaches the user's session automatically, so the
 * function call is authenticated the same way any other Supabase request is. */
export async function getWeeklyCoaching(): Promise<WeeklyCoachResult> {
  const [allHabits, recentLogs] = await Promise.all([
    getHabitsLocal(),
    getRecentLogsLocal(daysAgoIso(7)),
  ]);

  const habits = allHabits.map((h) => ({
    key: h.key,
    label: h.label,
    unit: h.unit,
    targetValue: h.targetValue,
  }));
  const logs = recentLogs.map((l) => {
    const habit = allHabits.find((h) => h.id === l.habitId);
    return {
      habitKey: habit?.key ?? l.habitId,
      logDate: l.logDate,
      value: l.value,
      moodScore: l.moodScore,
    };
  });

  const { data, error } = await supabase.functions.invoke('weekly-coach', {
    body: { habits, logs },
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to reach the coach — check your connection and try again.');
  }
  if (!data || typeof data.review !== 'string' || !Array.isArray(data.goals)) {
    throw new Error('The coach returned an unexpected response.');
  }

  return data as WeeklyCoachResult;
}
