import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getSyncMeta, setSyncMeta } from './localDb';

// Scheduled local notifications aren't meaningfully supported on web — this
// is a native-only feature, matching the plan's original scoping note for
// push/local notifications generally.
export function isNotificationsSupported(): boolean {
  return Platform.OS !== 'web';
}

const ENABLED_KEY = 'reminder_enabled';
const HOUR_KEY = 'reminder_hour';
const MINUTE_KEY = 'reminder_minute';
const SCHEDULED_ID_KEY = 'reminder_scheduled_id';
const ANDROID_CHANNEL_ID = 'reminders';

export const REMINDER_PRESETS = [
  { label: 'Morning', hour: 9, minute: 0 },
  { label: 'Afternoon', hour: 13, minute: 0 },
  { label: 'Evening', hour: 20, minute: 0 },
] as const;

/** Controls whether a notification that arrives while the app is already
 * open is actually shown — without this the default is to show nothing,
 * so a foreground test/preview would silently do nothing. Call once at
 * app startup. */
export function configureNotificationHandler(): void {
  if (!isNotificationsSupported()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export type ReminderPreference = { enabled: boolean; hour: number; minute: number };

export async function getReminderPreference(): Promise<ReminderPreference> {
  const [enabled, hour, minute] = await Promise.all([
    getSyncMeta(ENABLED_KEY),
    getSyncMeta(HOUR_KEY),
    getSyncMeta(MINUTE_KEY),
  ]);
  return {
    enabled: enabled === 'true',
    hour: hour ? Number(hour) : REMINDER_PRESETS[2].hour,
    minute: minute ? Number(minute) : REMINDER_PRESETS[2].minute,
  };
}

/** Requests permission (a harmless no-op prompt-wise once already decided)
 * and schedules a daily repeating local reminder at the given time,
 * replacing any previously scheduled one — so switching presets or
 * re-enabling never leaves a stale duplicate behind. Returns false if the
 * user denied permission, so the caller can show that in the UI instead of
 * silently doing nothing. */
export async function enableReminder(hour: number, minute: number): Promise<boolean> {
  if (!isNotificationsSupported()) return false;

  let settings = await Notifications.getPermissionsAsync();
  if (!settings.granted) {
    settings = await Notifications.requestPermissionsAsync();
  }
  if (!settings.granted) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Habit reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await cancelScheduledReminder();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to check in',
      body: "How's your day going? Log today's habits in MindLoop.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: ANDROID_CHANNEL_ID,
    },
  });

  await Promise.all([
    setSyncMeta(ENABLED_KEY, 'true'),
    setSyncMeta(HOUR_KEY, String(hour)),
    setSyncMeta(MINUTE_KEY, String(minute)),
    setSyncMeta(SCHEDULED_ID_KEY, id),
  ]);
  return true;
}

async function cancelScheduledReminder(): Promise<void> {
  const id = await getSyncMeta(SCHEDULED_ID_KEY);
  if (!id) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export async function disableReminder(): Promise<void> {
  if (!isNotificationsSupported()) return;
  await cancelScheduledReminder();
  await setSyncMeta(ENABLED_KEY, 'false');
}
