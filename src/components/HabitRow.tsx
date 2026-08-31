import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { habitIconName } from './habitIcon';
import { colors } from '@/theme/colors';
import type { Habit, HabitLogSource } from '@/types/habit';

const MOOD_EMOJI = ['😞', '🙁', '😐', '🙂', '😄'];

export function HabitRow({
  habit,
  value,
  moodScore,
  source,
  onAdjust,
  onSetMood,
}: {
  habit: Habit;
  value: number | null;
  moodScore: number | null;
  /** Present once today's row exists — undefined for a habit with no log yet
   * today, which is always manually-editable. */
  source?: HabitLogSource;
  onAdjust: (delta: number) => void;
  onSetMood: (score: number) => void;
}) {
  const isMood = habit.key === 'mood';
  // A HealthKit-synced row is read-only in the UI — editing it would just
  // get overwritten by the next background sync, which is confusing rather
  // than useful. Water/Mood are never HealthKit-sourced (see healthSync.ts).
  const isReadOnly = source === 'healthkit';

  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <Feather name={habitIconName(habit.icon)} size={20} color={colors.primary} />
      </View>

      <View className="flex-1">
        <Text className="font-medium text-foreground">{habit.label}</Text>
        {isMood ? (
          <Text className="text-sm text-muted-foreground">
            {moodScore ? `Feeling ${MOOD_EMOJI[moodScore - 1]}` : 'Not logged yet'}
          </Text>
        ) : (
          <Text className="text-sm text-muted-foreground">
            {value ?? 0}
            {habit.targetValue ? ` / ${habit.targetValue}` : ''} {habit.unit ?? ''}
          </Text>
        )}
      </View>

      {isReadOnly ? (
        <View
          className="flex-row items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1.5"
          accessibilityLabel={`${habit.label} synced automatically from Apple Health`}
        >
          <Feather name="heart" size={12} color={colors.primary} />
          <Text className="text-xs font-medium text-primary">Synced</Text>
        </View>
      ) : isMood ? (
        <View className="flex-row gap-1" accessibilityRole="radiogroup" accessibilityLabel="Mood">
          {MOOD_EMOJI.map((emoji, i) => {
            const score = i + 1;
            const selected = moodScore === score;
            return (
              <Pressable
                key={score}
                onPress={() => onSetMood(score)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Mood ${score} of 5`}
                className={`h-9 w-9 items-center justify-center rounded-full ${selected ? 'bg-accent/20' : ''}`}
              >
                <Text className="text-base">{emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => onAdjust(-1)}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${habit.label}`}
            className="h-9 w-9 items-center justify-center rounded-full border border-border"
          >
            <Feather name="minus" size={16} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => onAdjust(1)}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${habit.label}`}
            className="h-9 w-9 items-center justify-center rounded-full bg-primary"
          >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
