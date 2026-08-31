/** Single source of truth for the app's palette. Tailwind/NativeWind
 * classes (`bg-primary`, `text-muted-foreground`, …) read these via
 * tailwind.config.js — but Feather icons take a raw `color` prop that
 * className can't reach, so every icon in the app imports its color from
 * here instead of hardcoding a hex string, keeping the two in sync. */
export const colors = {
  background: '#FAF8F3',
  foreground: '#1C2620',
  card: '#FFFFFF',
  border: '#E9E4D8',
  primary: '#0EA672',
  primaryForeground: '#FFFFFF',
  accent: '#FF6B4A',
  accentForeground: '#FFFFFF',
  muted: '#F1EEE3',
  mutedForeground: '#6F7669',
} as const;

/** One distinct hue per habit for the Trends bar charts — chosen to feel
 * loosely tied to what each habit is (blue for water, violet for
 * night/sleep, amber for a book, teal for calm/meditation) while staying in
 * the same tasteful, muted-but-vivid register as primary/accent rather than
 * clashing with them. Falls back to primary for any habit key not listed
 * here (e.g. a future custom habit). */
export const chartColors: Record<string, string> = {
  water: '#3B82F6',
  sleep: '#8B5CF6',
  exercise: '#0EA672',
  meditation: '#14B8A6',
  reading: '#F59E0B',
};

export function chartColorFor(habitKey: string): string {
  return chartColors[habitKey] ?? colors.primary;
}
