import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { habitIconName } from './habitIcon';

export function StatTile({
  icon,
  label,
  valueLabel,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  valueLabel: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${valueLabel}`}
      className={`items-center gap-2 rounded-2xl border border-border p-4 ${
        active ? 'bg-primary/10' : 'bg-card'
      }`}
    >
      <View className="h-11 w-11 items-center justify-center rounded-full border border-border">
        <Feather name={habitIconName(icon)} size={20} color="#3F5C43" />
      </View>
      <Text className="font-medium text-foreground">{label}</Text>
      <Text className="text-sm text-muted-foreground">{valueLabel}</Text>
    </Pressable>
  );
}
