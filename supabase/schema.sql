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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create index if not exists habit_logs_user_date_idx on habit_logs (user_id, log_date);

alter table habits enable row level security;
alter table habit_logs enable row level security;

drop policy if exists "habits_owner" on habits;
create policy "habits_owner" on habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habit_logs_owner" on habit_logs;
create policy "habit_logs_owner" on habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Enables Supabase Realtime broadcasts for cross-device sync (next task).
alter publication supabase_realtime add table habits;
alter publication supabase_realtime add table habit_logs;
