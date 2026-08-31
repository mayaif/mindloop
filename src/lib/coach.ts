import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { getHabitsLocal, getRecentLogsLocal } from './localDb';

export type MicroGoal = {
  habitKey: string;
  title: string;
  description: string;
  action: 'commit' | 'review';
};

export type WeeklyCoachResult = { review: string; goals: MicroGoal[] };

/** A saved insight includes which goals the user already committed to, so
 * reopening Coach shows the same state you left it in. */
export type SavedInsight = WeeklyCoachResult & { committedGoalTitles: string[] };

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the current week, as YYYY-MM-DD — used to decide whether a
 * saved insight is still "this week's" or should be treated as stale. */
function startOfWeekIso(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d.toISOString().slice(0, 10);
}

/** Returns the saved insight only if it was generated for the current week
 * — an older one is treated as stale (not returned) so the Coach screen
 * falls back to the "Get this week's insight" prompt instead of showing
 * last week's advice as if it were current. */
export async function getSavedInsight(userId: string): Promise<SavedInsight | null> {
  const { data, error } = await supabase
    .from('coach_insights')
    .select('week_start, review, goals, committed_goal_titles')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data || data.week_start !== startOfWeekIso()) return null;

  return {
    review: data.review,
    goals: data.goals as MicroGoal[],
    committedGoalTitles: (data.committed_goal_titles as string[]) ?? [],
  };
}

/** Upserts this user's single current-insight row — there's only ever one,
 * replaced each time a fresh insight is generated (see the "one current
 * insight" scope decision, not a full history). */
async function saveInsight(userId: string, result: WeeklyCoachResult): Promise<void> {
  await supabase.from('coach_insights').upsert(
    {
      id: Crypto.randomUUID(),
      user_id: userId,
      week_start: startOfWeekIso(),
      review: result.review,
      goals: result.goals,
      committed_goal_titles: [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

/** Persists which goals the user has committed to for the currently-saved
 * insight — so leaving and returning to Coach (or restarting the app)
 * doesn't reset every "Commit" button back to un-pressed. */
export async function setCommittedGoals(userId: string, committedGoalTitles: string[]): Promise<void> {
  await supabase
    .from('coach_insights')
    .update({ committed_goal_titles: committedGoalTitles, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}

/** Gathers the last 7 days of local logs, invokes the weekly-coach Edge
 * Function (the only place the Groq key exists — see
 * supabase/functions/weekly-coach), and returns the review + micro-goals.
 * The Supabase client attaches the user's session automatically, so the
 * function call is authenticated the same way any other Supabase request is.
 * Saves the result as this week's current insight before returning, so a
 * real Groq call only ever happens when the user explicitly asks for a new
 * one (the initial request or "Refresh insight") — not on every visit to
 * the Coach tab. */
export async function getWeeklyCoaching(userId: string): Promise<WeeklyCoachResult> {
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

  const result = data as WeeklyCoachResult;
  // Best-effort: a save failure shouldn't hide a perfectly good insight the
  // user already got back — they'd just need to regenerate next visit.
  await saveInsight(userId, result).catch(() => {});
  return result;
}
