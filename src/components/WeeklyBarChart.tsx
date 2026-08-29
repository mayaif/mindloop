import { View, Text } from 'react-native';

type DayValue = { date: string; value: number };

/** Plain View-based bars (height as a percentage) rather than react-native-svg
 * — one less native dependency, and this doesn't need anything an SVG
 * would give beyond a bar's height, same reasoning as RuleForge's dashboard
 * trend chart. */
export function WeeklyBarChart({ days, target }: { days: DayValue[]; target: number | null }) {
  const max = Math.max(target ?? 0, ...days.map((d) => d.value), 1);

  return (
    <View>
      <View className="flex-row items-end justify-between gap-1.5" style={{ height: 64 }}>
        {days.map((d) => {
          const pct = Math.max(4, Math.round((d.value / max) * 100));
          const met = target != null && d.value >= target;
          return (
            <View key={d.date} className="flex-1 items-center justify-end" style={{ height: '100%' }}>
              <View
                accessibilityLabel={`${d.date}: ${d.value}`}
                className={`w-full rounded-t-sm ${met ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                style={{ height: `${pct}%` }}
              />
            </View>
          );
        })}
      </View>
      <View className="mt-1 flex-row justify-between">
        {days.map((d) => (
          <Text key={d.date} className="flex-1 text-center text-[10px] text-muted-foreground">
            {new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' })}
          </Text>
        ))}
      </View>
    </View>
  );
}
