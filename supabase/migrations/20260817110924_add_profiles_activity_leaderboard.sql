create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_length check (char_length(display_name) between 2 and 40)
);

create table public.game_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_date date not null,
  won boolean not null,
  attempts smallint not null check (attempts between 1 and 6),
  guesses text[] not null default '{}',
  completed_at timestamptz not null default now(),
  constraint game_results_user_puzzle_unique unique (user_id, puzzle_date),
  constraint game_results_not_in_future check (puzzle_date <= (completed_at at time zone 'UTC')::date),
  constraint game_results_loss_uses_all_attempts check (won or attempts = 6),
  constraint game_results_guess_count check (cardinality(guesses) = attempts),
  constraint game_results_no_null_guesses check (array_position(guesses, null) is null)
);

create table public.player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  played integer not null default 0 check (played >= 0),
  wins integer not null default 0 check (wins >= 0),
  misses integer not null default 0 check (misses >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  max_streak integer not null default 0 check (max_streak >= 0),
  total_guesses integer not null default 0 check (total_guesses >= 0),
  last_played date,
  updated_at timestamptz not null default now(),
  constraint player_stats_totals_match check (played = wins + misses)
);

create index game_results_user_completed_idx
on public.game_results (user_id, completed_at desc);

create index player_stats_leaderboard_idx
on public.player_stats (wins desc, max_streak desc, total_guesses asc);

alter table public.profiles enable row level security;
alter table public.game_results enable row level security;
alter table public.player_stats enable row level security;

revoke all on table public.profiles, public.game_results, public.player_stats from anon;
revoke all on table public.profiles, public.game_results, public.player_stats from authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.game_results to authenticated;
grant usage, select on sequence public.game_results_id_seq to authenticated;
grant select on table public.player_stats to authenticated;

create policy "Players can view their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Players can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Players can read their own results"
on public.game_results for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Players can insert their own results"
on public.game_results for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Players can update their own results"
on public.game_results for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Authenticated players can view the leaderboard"
on public.player_stats for select
to authenticated
using (true);

create or replace function private.rebuild_player_stats(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_username text;
  profile_display_name text;
  total_played integer;
  total_wins integer;
  total_misses integer;
  solved_guesses integer;
  latest_date date;
  latest_won boolean;
  active_streak integer;
  best_streak integer;
begin
  select username, display_name into profile_username, profile_display_name
  from public.profiles
  where id = target_user_id;

  if profile_username is null then
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where won)::integer,
    count(*) filter (where not won)::integer,
    coalesce(sum(attempts) filter (where won), 0)::integer,
    max(puzzle_date)
  into total_played, total_wins, total_misses, solved_guesses, latest_date
  from public.game_results
  where user_id = target_user_id;

  select won into latest_won
  from public.game_results
  where user_id = target_user_id
  order by puzzle_date desc
  limit 1;

  with winning_days as (
    select
      puzzle_date,
      puzzle_date - (row_number() over (order by puzzle_date))::integer as streak_group
    from public.game_results
    where user_id = target_user_id and won
  ), streaks as (
    select count(*)::integer as length, max(puzzle_date) as end_date
    from winning_days
    group by streak_group
  )
  select
    coalesce(max(length) filter (where latest_won and end_date = latest_date), 0),
    coalesce(max(length), 0)
  into active_streak, best_streak
  from streaks;

  insert into public.player_stats (
    user_id, username, display_name, played, wins, misses, current_streak,
    max_streak, total_guesses, last_played, updated_at
  ) values (
    target_user_id, profile_username, profile_display_name, total_played, total_wins, total_misses,
    active_streak, best_streak, solved_guesses, latest_date, now()
  )
  on conflict (user_id) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    played = excluded.played,
    wins = excluded.wins,
    misses = excluded.misses,
    current_streak = excluded.current_streak,
    max_streak = excluded.max_streak,
    total_guesses = excluded.total_guesses,
    last_played = excluded.last_played,
    updated_at = excluded.updated_at;
end;
$$;

revoke execute on function private.rebuild_player_stats(uuid)
from public, anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_username text;
  generated_name text;
begin
  generated_username := 'player_' || substring(replace(new.id::text, '-', '') from 1 for 8);
  generated_name := case
    when char_length(trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''))) between 2 and 40
      then trim(new.raw_user_meta_data ->> 'display_name')
    else 'Player ' || upper(substring(replace(new.id::text, '-', '') from 1 for 4))
  end;

  insert into public.profiles (id, username, display_name)
  values (new.id, generated_username, generated_name)
  on conflict (id) do nothing;

  insert into public.player_stats (user_id, username, display_name)
  values (new.id, generated_username, generated_name)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function private.handle_new_user()
from public, anon, authenticated;

create or replace function private.handle_result_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.rebuild_player_stats(old.user_id);
  else
    perform private.rebuild_player_stats(new.user_id);
    if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
      perform private.rebuild_player_stats(old.user_id);
    end if;
  end if;
  return null;
end;
$$;

revoke execute on function private.handle_result_change()
from public, anon, authenticated;

create or replace function private.handle_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  if old.username is distinct from new.username or old.display_name is distinct from new.display_name then
    update public.player_stats
    set username = new.username, display_name = new.display_name, updated_at = now()
    where user_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function private.handle_profile_update()
from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create trigger on_game_result_changed
after insert or update or delete on public.game_results
for each row execute function private.handle_result_change();

create trigger before_profile_update
before update on public.profiles
for each row execute function private.handle_profile_update();

insert into public.profiles (id, username, display_name)
select
  id,
  'player_' || substring(replace(id::text, '-', '') from 1 for 8),
  'Player ' || upper(substring(replace(id::text, '-', '') from 1 for 4))
from auth.users
on conflict (id) do nothing;

insert into public.player_stats (user_id, username, display_name)
select id, username, display_name
from public.profiles
on conflict (user_id) do nothing;

do $$
declare
  existing_user record;
begin
  for existing_user in select id from public.profiles loop
    perform private.rebuild_player_stats(existing_user.id);
  end loop;
end;
$$;
