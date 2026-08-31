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
