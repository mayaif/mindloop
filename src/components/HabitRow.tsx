import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { habitIconName } from './habitIcon';
import type { Habit } from '@/types/habit';

const MOOD_EMOJI = ['😞', '🙁', '😐', '🙂', '😄'];

export function HabitRow({
  habit,
  value,
  moodScore,
  onAdjust,
  onSetMood,
}: {
  habit: Habit;
  value: number | null;
  moodScore: number | null;
  onAdjust: (delta: number) => void;
  onSetMood: (score: number) => void;
}) {
  const isMood = habit.key === 'mood';

  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <View className="h-11 w-11 items-center justify-center rounded-full border border-border">
        <Feather name={habitIconName(habit.icon)} size={20} color="#3F5C43" />
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

      {isMood ? (
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
                className={`h-9 w-9 items-center justify-center rounded-full ${selected ? 'bg-primary/20' : ''}`}
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
            <Feather name="minus" size={16} color="#3F5C43" />
          </Pressable>
          <Pressable
            onPress={() => onAdjust(1)}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${habit.label}`}
            className="h-9 w-9 items-center justify-center rounded-full bg-primary"
          >
            <Feather name="plus" size={16} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
