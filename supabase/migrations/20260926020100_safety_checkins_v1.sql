-- Safety check-ins: a personal, private "I'm safe" marker a user can attach to a specific hazard
-- event near one of their Watch Locations (a fire, an earthquake, a tornado warning, ...).
-- This is a personal record only — never shared with anyone else, never broadcast (Non-goal: no
-- social features). RLS scopes every row to its own user, same pattern as notification_rules.
create table public.safety_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  watch_location_id uuid not null references public.watch_locations(id) on delete cascade,
  -- Nullable: the underlying cached_hazard_events row can expire/be pruned, but the check-in
  -- (and its snapshot of what it was for, below) should still be visible.
  hazard_event_id uuid references public.cached_hazard_events(id) on delete set null,
  event_type text not null,
  event_title text not null check (char_length(event_title) between 1 and 200),
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now()
);

-- One check-in per user per specific event; re-marking safe is a no-op, not a new row.
create unique index safety_checkins_user_event_idx
  on public.safety_checkins (user_id, hazard_event_id)
  where hazard_event_id is not null;

create index safety_checkins_user_created_idx on public.safety_checkins (user_id, created_at desc);
create index safety_checkins_location_idx on public.safety_checkins (watch_location_id);

alter table public.safety_checkins enable row level security;

create policy "users manage safety check-ins for their own locations"
  on public.safety_checkins for all to authenticated
  using (
    auth.uid() = user_id
    and exists (select 1 from public.watch_locations wl where wl.id = watch_location_id and wl.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.watch_locations wl where wl.id = watch_location_id and wl.user_id = auth.uid())
  );
