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
  // Deeper than the first pass (#0EA672) — that only hit 3.13:1 contrast
  // against white button text, below WCAG AA's 4.5:1 minimum for normal
  // text. This still reads as a distinctly vivid emerald (nowhere near the
  // original muted #3F5C43 sage), just dark enough to keep "Continue as
  // guest"/"Save"/"Commit" etc. actually readable. Verified: 5.36:1.
  primary: '#0A7A52',
  primaryForeground: '#FFFFFF',
  // accent only hits 2.65:1 against the background and 2.82:1 against
  // white — fine as an icon color or a translucent tint (its current uses),
  // but do not use it as solid text color on background/card without
  // re-checking contrast first.
  accent: '#FF6B4A',
  accentForeground: '#FFFFFF',
  muted: '#F1EEE3',
  // Darkened from #6F7669 (4.43:1 against the background — just under
  // WCAG AA's 4.5:1). Verified: 5.95:1.
  mutedForeground: '#5B6255',
} as const;

/** One distinct hue per habit for the Trends bar charts — chosen to feel
 * loosely tied to what each habit is (blue for water, violet for
 * night/sleep, amber for a book, teal for calm/meditation) while staying in
 * the same tasteful, muted-but-vivid register as primary/accent rather than
 * clashing with them. Falls back to primary for any habit key not listed
 * here (e.g. a future custom habit) — Steps intentionally isn't listed, so
 * it always tracks whatever `primary` currently is instead of duplicating
 * the hex and risking the two drifting apart. */
export const chartColors: Record<string, string> = {
  water: '#3B82F6',
  sleep: '#8B5CF6',
  meditation: '#14B8A6',
  reading: '#F59E0B',
};

export function chartColorFor(habitKey: string): string {
  return chartColors[habitKey] ?? colors.primary;
}
