import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { getWeeklyCoaching, getSavedInsight, setCommittedGoals, type MicroGoal } from '@/lib/coach';
import { Card } from '@/components/Card';
import { habitIconName } from '@/components/habitIcon';
import { useAppSyncContext } from '@/lib/AppSyncContext';

export default function CoachScreen() {
  const { userId } = useAppSyncContext();
  const [checkingSaved, setCheckingSaved] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [goals, setGoals] = useState<MicroGoal[]>([]);
  const [committed, setCommitted] = useState<Set<string>>(new Set());

  // On opening Coach, check for an insight already saved for the current
  // week before showing the "Get this week's insight" prompt — a real Groq
  // call only happens when the user explicitly asks for one, not on every
  // visit to this tab.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void getSavedInsight(userId).then((saved) => {
      if (cancelled || !saved) return;
      setReview(saved.review);
      setGoals(saved.goals);
      setCommitted(new Set(saved.committedGoalTitles));
    }).finally(() => {
      if (!cancelled) setCheckingSaved(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function fetchInsight() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getWeeklyCoaching(userId);
      setReview(result.review);
      setGoals(result.goals);
      setCommitted(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the coach.');
    } finally {
      setLoading(false);
    }
  }

  function commitGoal(title: string) {
    if (!userId) return;
    const next = new Set(committed).add(title);
    setCommitted(next);
    void setCommittedGoals(userId, Array.from(next));
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 p-6" accessibilityLabel="Coach">
        <View className="gap-1">
          <Text className="text-2xl font-semibold text-foreground">Your Weekly Insight</Text>
          <Text className="text-muted-foreground">
            Let&apos;s review the past few days and set a gentle course for the week ahead.
          </Text>
        </View>

        {checkingSaved && (
          <View className="items-center py-8">
            <ActivityIndicator />
          </View>
        )}

        {!checkingSaved && !review && !loading && (
          <Pressable
            onPress={fetchInsight}
            accessibilityRole="button"
            className="items-center rounded-xl bg-primary py-3.5 active:opacity-90"
          >
            <Text className="font-medium text-primary-foreground">Get this week&apos;s insight</Text>
          </Pressable>
        )}

        {loading && (
          <View className="items-center gap-2 py-8" accessibilityLiveRegion="polite">
            <ActivityIndicator />
            <Text className="text-sm text-muted-foreground">Reviewing your week…</Text>
          </View>
        )}

        {error && (
          <Text accessibilityRole="alert" className="text-sm text-red-600">
            {error}
          </Text>
        )}

        {review && (
          <Card>
            <View className="mb-2 flex-row items-center gap-2">
              <Feather name="cloud" size={16} color="#3F5C43" />
              <Text className="font-semibold text-foreground">Review</Text>
            </View>
            <Text className="leading-relaxed text-foreground">{review}</Text>
          </Card>
        )}

        {goals.length > 0 && (
          <View className="gap-3">
            <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Next Week&apos;s Micro-Goals
            </Text>
            {goals.map((goal) => {
              const isCommitted = committed.has(goal.title);
              return (
                <Card key={goal.title}>
                  <View className="mb-1 flex-row items-center gap-2">
                    <Feather name={habitIconName(goal.habitKey === 'mood' ? 'smile' : goal.habitKey)} size={14} color="#6B7268" />
                    <Text className="text-xs uppercase tracking-wide text-muted-foreground">{goal.habitKey}</Text>
                  </View>
                  <Text className="mb-1 text-lg font-semibold text-foreground">{goal.title}</Text>
                  <Text className="mb-3 text-sm text-muted-foreground">{goal.description}</Text>
                  <Pressable
                    onPress={() => commitGoal(goal.title)}
                    disabled={isCommitted}
                    accessibilityRole="button"
                    className={`items-center rounded-full py-2.5 ${
                      isCommitted ? 'border border-border' : goal.action === 'commit' ? 'bg-primary' : 'border border-border'
                    }`}
                  >
                    <Text className={isCommitted || goal.action === 'review' ? 'font-medium text-foreground' : 'font-medium text-primary-foreground'}>
                      {isCommitted ? 'Committed' : goal.action === 'commit' ? 'Commit' : 'Review'}
                    </Text>
                  </Pressable>
                </Card>
              );
            })}
          </View>
        )}

        {review && (
          <Pressable onPress={fetchInsight} accessibilityRole="button" className="items-center py-2">
            <Text className="text-sm text-primary">Refresh insight</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
