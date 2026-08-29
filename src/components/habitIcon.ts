import type { Feather } from '@expo/vector-icons';

/** Maps a habit's `icon` field (set in DEFAULT_HABITS) to a Feather glyph name
 * — kept as a small lookup rather than storing font-specific names in the
 * data layer, so swapping icon sets later doesn't touch stored data. */
export const HABIT_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  droplet: 'droplet',
  moon: 'moon',
  activity: 'activity',
  smile: 'smile',
  wind: 'wind',
  book: 'book-open',
};

export function habitIconName(icon: string): keyof typeof Feather.glyphMap {
  return HABIT_ICONS[icon] ?? 'circle';
}
