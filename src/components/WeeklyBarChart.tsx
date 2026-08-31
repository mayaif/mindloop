import { View, Text } from 'react-native';

type DayValue = { date: string; value: number };

/** Plain View-based bars (height as a percentage) rather than react-native-svg
 * — one less native dependency, and this doesn't need anything an SVG
 * would give beyond a bar's height, same reasoning as RuleForge's dashboard
 * trend chart. */
export function WeeklyBarChart({
  days,
  target,
  color,
  unit,
}: {
  days: DayValue[];
  target: number | null;
  /** Per-habit hue (see theme/colors.ts chartColorFor) — a day that hit its
   * target renders at full color, one that didn't renders the same hue at
   * low opacity, so each habit's chart keeps its own identity instead of
   * every chart sharing one met/not-met color pair. */
  color: string;
  unit: string | null;
}) {
  const max = Math.max(target ?? 0, ...days.map((d) => d.value), 1);

  return (
    <View>
      <View className="flex-row items-end justify-between gap-1.5" style={{ height: 64 }}>
        {days.map((d) => {
          const pct = Math.max(4, Math.round((d.value / max) * 100));
          const met = target != null && d.value >= target;
          const weekdayFull = new Date(d.date).toLocaleDateString(undefined, { weekday: 'long' });
          const label = `${weekdayFull}: ${d.value}${unit ? ` ${unit}` : ''}${
            target != null ? (met ? ', target met' : `, target ${target}${unit ? ` ${unit}` : ''}`) : ''
          }`;
          return (
            <View key={d.date} className="flex-1 items-center justify-end" style={{ height: '100%' }}>
              <View
                accessibilityLabel={label}
                className="w-full rounded-t-sm"
                style={{ height: `${pct}%`, backgroundColor: color, opacity: met ? 1 : 0.3 }}
              />
            </View>
          );
        })}
      </View>
      <View className="mt-1 flex-row justify-between">
        {days.map((d) => (
          <Text
            key={d.date}
            className="flex-1 text-center text-[10px] text-muted-foreground"
            aria-hidden={true}
          >
            {new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' })}
          </Text>
        ))}
      </View>
    </View>
  );
}
