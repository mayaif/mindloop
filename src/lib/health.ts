import { Platform } from 'react-native';

// The native HealthKit module only exists on iOS — importing it eagerly
// would crash the Android/web bundles at load time (no such native module
// registered there), so every entry point in this file loads it lazily and
// is a safe no-op everywhere else.
async function loadHealthKit() {
  if (Platform.OS !== 'ios') return null;
  return import('@kingstinct/react-native-healthkit');
}

export async function isHealthKitSupported(): Promise<boolean> {
  const hk = await loadHealthKit();
  if (!hk) return false;
  try {
    return await hk.isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

const READ_TYPES = [
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const;

/** Presents the system permission sheet. Apple's privacy model deliberately
 * doesn't tell an app whether the user actually granted read access (only
 * write/share permissions are inspectable) — the boolean here just reflects
 * whether the request round-trip completed, not the outcome. The only real
 * signal of "did this work" is whether a later read returns data. */
export async function requestHealthAuthorization(): Promise<boolean> {
  const hk = await loadHealthKit();
  if (!hk) return false;
  try {
    return await hk.requestAuthorization({ toRead: READ_TYPES });
  } catch {
    return false;
  }
}

export type HealthSnapshot = {
  exerciseMinutes: number | null;
  sleepHours: number | null;
};

// asleepUnspecified/asleep(1), asleepCore(3), asleepDeep(4), asleepREM(5) all
// count as "asleep" — excludes inBed(0), which HealthKit logs separately for
// the time someone was in bed but not necessarily sleeping.
const ASLEEP_VALUES = new Set([1, 3, 4, 5]);

async function readExerciseMinutes(
  hk: typeof import('@kingstinct/react-native-healthkit'),
  startOfDay: Date,
  now: Date
): Promise<number | null> {
  try {
    const stats = await hk.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierAppleExerciseTime',
      ['cumulativeSum'],
      { unit: 'min', filter: { date: { startDate: startOfDay, endDate: now } } }
    );
    return stats.sumQuantity ? Math.round(stats.sumQuantity.quantity) : 0;
  } catch {
    return null;
  }
}

async function readSleepHours(
  hk: typeof import('@kingstinct/react-native-healthkit'),
  now: Date
): Promise<number | null> {
  try {
    // "Last night's sleep" doesn't line up with a calendar day boundary —
    // looking back a full 24h from "now" comfortably covers a normal sleep
    // window no matter what time of day the user opens the app.
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const samples = await hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      limit: 0,
      filter: { date: { startDate: windowStart, endDate: now } },
    });
    const asleepMs = samples
      .filter((s) => ASLEEP_VALUES.has(s.value))
      .reduce((sum, s) => sum + (s.endDate.getTime() - s.startDate.getTime()), 0);
    return Math.round((asleepMs / 1000 / 60 / 60) * 10) / 10;
  } catch {
    return null;
  }
}

/** Reads today's Exercise minutes and last night's Sleep hours from
 * HealthKit. Either field comes back `null` (not 0) if the read itself
 * failed (e.g. permission never granted) — callers should treat `null` as
 * "no data available" and leave any existing manually-logged value alone,
 * distinct from a genuine `0` reading. */
export async function readTodayHealthSnapshot(): Promise<HealthSnapshot> {
  const hk = await loadHealthKit();
  if (!hk) return { exerciseMinutes: null, sleepHours: null };

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [exerciseMinutes, sleepHours] = await Promise.all([
    readExerciseMinutes(hk, startOfDay, now),
    readSleepHours(hk, now),
  ]);

  return { exerciseMinutes, sleepHours };
}
