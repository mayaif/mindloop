export type HabitKey = 'water' | 'sleep' | 'exercise' | 'mood' | 'meditation' | 'reading';

export type Habit = {
  id: string;
  userId: string | null;
  key: HabitKey | string;
  label: string;
  icon: string;
  unit: string | null;
  targetValue: number | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Where a log's value came from — 'healthkit' rows are written by the
 * Apple Health sync (see lib/health.ts) rather than a manual +/- tap, and
 * the UI treats them as read-only so a background re-sync can't be
 * silently clobbered by a stale manual edit. */
export type HabitLogSource = 'manual' | 'healthkit';

export type HabitLog = {
  id: string;
  userId: string | null;
  habitId: string;
  logDate: string; // YYYY-MM-DD
  value: number | null;
  moodScore: number | null;
  note: string | null;
  source: HabitLogSource;
  createdAt: string;
  updatedAt: string;
};

/** The default habits seeded on first launch, matching the Stitch design
 * reference (Water/Sleep/Exercise/Mood on the dashboard, plus Meditation and
 * Reading on the Habit Details screen). */
export const DEFAULT_HABITS: Omit<Habit, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'archived'>[] = [
  { key: 'water', label: 'Hydration', icon: 'droplet', unit: 'glasses', targetValue: 8 },
  { key: 'sleep', label: 'Sleep Quality', icon: 'moon', unit: 'hours', targetValue: 8 },
  { key: 'exercise', label: 'Exercise', icon: 'activity', unit: 'minutes', targetValue: 30 },
  { key: 'mood', label: 'Mood', icon: 'smile', unit: null, targetValue: null },
  { key: 'meditation', label: 'Meditation', icon: 'wind', unit: 'minutes', targetValue: 15 },
  { key: 'reading', label: 'Reading', icon: 'book', unit: 'pages', targetValue: 30 },
];
