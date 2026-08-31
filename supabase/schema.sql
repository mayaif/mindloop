-- MindLoop — Supabase Postgres schema (the server-side mirror of the local
-- SQLite database). Run this once in the Supabase SQL editor for your project.
--
-- IDs are generated client-side (expo-crypto randomUUID) rather than by
-- Postgres, so the same row has the same primary key locally and remotely —
-- required for the offline-first sync logic to reconcile rows correctly
-- instead of creating duplicates.

create table if not exists habits (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  label text not null,
  icon text not null default 'circle',
  unit text,
  target_value numeric,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists habit_logs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  log_date date not null,
  value numeric,
  mood_score smallint,
  note text,
  -- 'manual' (typed in) or 'healthkit' (written by the Apple Health sync) —
  -- the app treats healthkit rows as read-only so a stale manual edit can't
  -- race a background re-sync.
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

-- Safe to re-run: adds `source` to a habit_logs table that was created
-- before this column existed (a project that ran this file previously).
alter table habit_logs add column if not exists source text not null default 'manual';

create index if not exists habit_logs_user_date_idx on habit_logs (user_id, log_date);

-- One row per user holding their most recent AI coach insight — not local
-- SQLite-mirrored like habits/habit_logs, since generating one inherently
-- needs a network call to the weekly-coach Edge Function anyway, so there's
-- no offline-first case to support here. `week_start` (the Monday of the
-- week it was generated for) is how the app decides whether a saved
-- insight is still current or should be treated as stale and regenerated.
create table if not exists coach_insights (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade unique,
  week_start date not null,
  review text not null,
  goals jsonb not null,
  committed_goal_titles jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table coach_insights enable row level security;

drop policy if exists "habits_owner" on habits;
create policy "habits_owner" on habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habit_logs_owner" on habit_logs;
create policy "habit_logs_owner" on habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "coach_insights_owner" on coach_insights;
create policy "coach_insights_owner" on coach_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Enables Supabase Realtime broadcasts for cross-device sync (next task).
alter publication supabase_realtime add table habits;
alter publication supabase_realtime add table habit_logs;
