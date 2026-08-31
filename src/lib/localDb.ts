import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { Habit, HabitLog } from '@/types/habit';

let dbPromise: Promise<SQLiteDatabase> | null = null;

function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('mindloop.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS habits (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          key TEXT NOT NULL,
          label TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT 'circle',
          unit TEXT,
          target_value REAL,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          dirty INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS habit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          habit_id TEXT NOT NULL,
          log_date TEXT NOT NULL,
          value REAL,
          mood_score INTEGER,
          note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          dirty INTEGER NOT NULL DEFAULT 1,
          UNIQUE(habit_id, log_date)
        );

        CREATE TABLE IF NOT EXISTS sync_meta (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
      // CREATE TABLE IF NOT EXISTS never adds columns to a table that already
      // existed before this field was introduced — a real device that
      // installed the app pre-HealthKit needs this added by hand, guarded
      // since re-running ALTER TABLE ADD COLUMN on a column that already
      // exists throws.
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(habit_logs)');
      if (!columns.some((c) => c.name === 'source')) {
        await db.execAsync("ALTER TABLE habit_logs ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
      }
      return db;
    });
  }
  return dbPromise;
}

// --- row <-> local-schema mapping -------------------------------------

type HabitRow = {
  id: string;
  user_id: string | null;
  key: string;
  label: string;
  icon: string;
  unit: string | null;
  target_value: number | null;
  archived: number;
  created_at: string;
  updated_at: string;
};

type HabitLogRow = {
  id: string;
  user_id: string | null;
  habit_id: string;
  log_date: string;
  value: number | null;
  mood_score: number | null;
  note: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

function habitFromRow(r: HabitRow): Habit {
  return {
    id: r.id,
    userId: r.user_id,
    key: r.key,
    label: r.label,
    icon: r.icon,
    unit: r.unit,
    targetValue: r.target_value,
    archived: r.archived === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function logFromRow(r: HabitLogRow): HabitLog {
  return {
    id: r.id,
    userId: r.user_id,
    habitId: r.habit_id,
    logDate: r.log_date,
    value: r.value,
    moodScore: r.mood_score,
    note: r.note,
    source: r.source === 'healthkit' ? 'healthkit' : 'manual',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// --- habits -------------------------------------------------------------

export async function getHabitsLocal(): Promise<Habit[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HabitRow>(
    'SELECT * FROM habits WHERE archived = 0 ORDER BY created_at ASC'
  );
  return rows.map(habitFromRow);
}

/** Inserts or updates a habit locally and marks it dirty (needs pushing),
 * unless `dirty` is explicitly set to false — used when applying a row that
 * just came *from* the server, which shouldn't immediately be re-pushed. */
export async function upsertHabitLocal(habit: Habit, dirty = true): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO habits (id, user_id, key, label, icon, unit, target_value, archived, created_at, updated_at, dirty)
     VALUES ($id, $userId, $key, $label, $icon, $unit, $targetValue, $archived, $createdAt, $updatedAt, $dirty)
     ON CONFLICT(id) DO UPDATE SET
       user_id=excluded.user_id, key=excluded.key, label=excluded.label, icon=excluded.icon,
       unit=excluded.unit, target_value=excluded.target_value, archived=excluded.archived,
       updated_at=excluded.updated_at, dirty=excluded.dirty
     WHERE excluded.updated_at >= habits.updated_at`,
    {
      $id: habit.id,
      $userId: habit.userId,
      $key: habit.key,
      $label: habit.label,
      $icon: habit.icon,
      $unit: habit.unit,
      $targetValue: habit.targetValue,
      $archived: habit.archived ? 1 : 0,
      $createdAt: habit.createdAt,
      $updatedAt: habit.updatedAt,
      $dirty: dirty ? 1 : 0,
    }
  );
}

// --- habit logs -----------------------------------------------------------

export async function getLogsForDateLocal(logDate: string): Promise<HabitLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HabitLogRow>(
    'SELECT * FROM habit_logs WHERE log_date = ?',
    [logDate]
  );
  return rows.map(logFromRow);
}

export async function getRecentLogsLocal(sinceDate: string): Promise<HabitLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HabitLogRow>(
    'SELECT * FROM habit_logs WHERE log_date >= ? ORDER BY log_date ASC',
    [sinceDate]
  );
  return rows.map(logFromRow);
}

export async function upsertHabitLogLocal(log: HabitLog, dirty = true): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO habit_logs (id, user_id, habit_id, log_date, value, mood_score, note, source, created_at, updated_at, dirty)
     VALUES ($id, $userId, $habitId, $logDate, $value, $moodScore, $note, $source, $createdAt, $updatedAt, $dirty)
     ON CONFLICT(habit_id, log_date) DO UPDATE SET
       value=excluded.value, mood_score=excluded.mood_score, note=excluded.note, source=excluded.source,
       updated_at=excluded.updated_at, dirty=excluded.dirty
     WHERE excluded.updated_at >= habit_logs.updated_at`,
    {
      $id: log.id,
      $userId: log.userId,
      $habitId: log.habitId,
      $logDate: log.logDate,
      $value: log.value,
      $moodScore: log.moodScore,
      $note: log.note,
      $source: log.source,
      $createdAt: log.createdAt,
      $updatedAt: log.updatedAt,
      $dirty: dirty ? 1 : 0,
    }
  );
}

// --- sync bookkeeping -----------------------------------------------------

export async function getDirtyHabits(): Promise<Habit[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HabitRow>('SELECT * FROM habits WHERE dirty = 1');
  return rows.map(habitFromRow);
}

export async function getDirtyHabitLogs(): Promise<HabitLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HabitLogRow>('SELECT * FROM habit_logs WHERE dirty = 1');
  return rows.map(logFromRow);
}

export async function markHabitsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.runAsync(
    `UPDATE habits SET dirty = 0 WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
}

export async function markHabitLogsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.runAsync(
    `UPDATE habit_logs SET dirty = 0 WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
}

export async function getSyncMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_meta WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [key, value]
  );
}
