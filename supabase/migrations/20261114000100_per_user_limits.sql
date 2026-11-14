-- NW-05: per-user fair-use limits that also hold for direct PostgREST writes (which skip the API's
-- Zod checks). Without them one account could insert thousands of places, fill the worker's
-- MAX_CELLS_PER_RUN cap so other people's places stop being polled, and burn the AirNow quota.
-- Mirrors MAX_LOCATIONS_PER_USER / MAX_RULES_PER_USER / MAX_PUSH_SUBSCRIPTIONS_PER_USER in
-- packages/shared/src/constants.ts. Errors use SQLSTATE 'NWLIM' so the API can map them to its
-- error envelope.

-- watch_locations: at most 25 per user ------------------------------------------------------
create or replace function public.enforce_watch_location_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Serialise concurrent inserts for one user so two requests can't both pass the count.
  perform pg_advisory_xact_lock(hashtextextended('watch_locations:' || new.user_id::text, 0));
  if (select count(*) from public.watch_locations where user_id = new.user_id) >= 25 then
    raise exception 'You can save up to 25 places. Remove one to add another.'
      using errcode = 'NWLIM';
  end if;
  return new;
end;
$$;

create trigger watch_locations_enforce_limit
  before insert on public.watch_locations
  for each row execute function public.enforce_watch_location_limit();

-- notification_rules: at most 50 per user (across all of their places) ----------------------
create or replace function public.enforce_notification_rule_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.watch_locations where id = new.watch_location_id;
  if owner is null then
    return new; -- the foreign key reports the missing location
  end if;
  perform pg_advisory_xact_lock(hashtextextended('notification_rules:' || owner::text, 0));
  if (
    select count(*)
    from public.notification_rules r
    join public.watch_locations wl on wl.id = r.watch_location_id
    where wl.user_id = owner
  ) >= 50 then
    raise exception 'You can have up to 50 notification rules. Remove one to add another.'
      using errcode = 'NWLIM';
  end if;
  return new;
end;
$$;

create trigger notification_rules_enforce_limit
  before insert on public.notification_rules
  for each row execute function public.enforce_notification_rule_limit();

-- push_subscriptions: at most 10 per user ---------------------------------------------------
-- The API upserts on endpoint, and BEFORE INSERT triggers fire even when the row then becomes an
-- update, so re-registering an endpoint the user already has is always allowed.
create or replace function public.enforce_push_subscription_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('push_subscriptions:' || new.user_id::text, 0));
  if exists (select 1 from public.push_subscriptions where user_id = new.user_id and endpoint = new.endpoint) then
    return new;
  end if;
  if (select count(*) from public.push_subscriptions where user_id = new.user_id) >= 10 then
    raise exception 'Push notifications are on for 10 browsers already. Turn them off on one to add another.'
      using errcode = 'NWLIM';
  end if;
  return new;
end;
$$;

create trigger push_subscriptions_enforce_limit
  before insert on public.push_subscriptions
  for each row execute function public.enforce_push_subscription_limit();

-- Trigger functions are not meant to be called directly through the API.
revoke execute on function public.enforce_watch_location_limit() from public, anon, authenticated;
revoke execute on function public.enforce_notification_rule_limit() from public, anon, authenticated;
revoke execute on function public.enforce_push_subscription_limit() from public, anon, authenticated;

-- Bound free text that direct writes could otherwise fill with anything. Lengths match the API's
-- createLocationSchema (city_name 120, state 60; label and coordinates are already checked).
-- NOT VALID: existing rows are not rechecked; new and updated rows must comply.
alter table public.watch_locations
  add constraint watch_locations_city_name_length check (city_name is null or char_length(city_name) <= 120) not valid,
  add constraint watch_locations_state_length check (state is null or char_length(state) <= 60) not valid;
