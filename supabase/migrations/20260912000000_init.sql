-- AllClear — initial schema (see docs/AllClear-TECH_SPEC.md §2–3)
-- Target: Supabase Postgres. PostGIS lives in the `extensions` schema on Supabase.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
-- PostGIS types/functions live in `extensions`; API roles need USAGE to resolve them inside the RPCs below.
grant usage on schema extensions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.layer_type as enum ('weather', 'wildfire', 'earthquake', 'air_quality');
create type public.notification_layer_type as enum ('weather', 'wildfire', 'earthquake', 'air_quality', 'official_alerts');
create type public.condition_type as enum ('distance_threshold_miles', 'magnitude_threshold', 'aqi_threshold', 'any_active');
create type public.notification_channel as enum ('web_push', 'email', 'both');
create type public.delivery_channel as enum ('web_push', 'email');
create type public.hazard_source as enum ('nws', 'firms', 'inciweb', 'usgs', 'airnow');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- watch_locations
-- ---------------------------------------------------------------------------
create table public.watch_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  city_name text,
  state text,
  country text not null default 'US',
  is_primary boolean not null default false,
  geog extensions.geography(Point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(longitude::double precision, latitude::double precision), 4326)::extensions.geography
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index watch_locations_user_id_idx on public.watch_locations (user_id);
create index watch_locations_geog_idx on public.watch_locations using gist (geog);
create unique index watch_locations_one_primary_idx on public.watch_locations (user_id) where is_primary;

create trigger watch_locations_set_updated_at
  before update on public.watch_locations
  for each row execute function public.set_updated_at();

-- First location for a user becomes primary; setting a new primary clears the old one.
create or replace function public.watch_locations_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and not new.is_primary then
    if not exists (select 1 from public.watch_locations where user_id = new.user_id) then
      new.is_primary := true;
    end if;
  end if;
  if new.is_primary then
    update public.watch_locations
      set is_primary = false
      where user_id = new.user_id and is_primary and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger watch_locations_before_write
  before insert or update of is_primary on public.watch_locations
  for each row execute function public.watch_locations_before_write();

-- ---------------------------------------------------------------------------
-- location_layers
-- ---------------------------------------------------------------------------
create table public.location_layers (
  id uuid primary key default gen_random_uuid(),
  watch_location_id uuid not null references public.watch_locations(id) on delete cascade,
  layer_type public.layer_type not null,
  enabled boolean not null default true,
  radius_miles numeric(6, 1) check (radius_miles is null or radius_miles between 1 and 500),
  min_magnitude numeric(3, 1) check (min_magnitude is null or min_magnitude between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watch_location_id, layer_type)
);

create index location_layers_watch_location_id_idx on public.location_layers (watch_location_id);

create trigger location_layers_set_updated_at
  before update on public.location_layers
  for each row execute function public.set_updated_at();

-- Every new Watch Location starts with all four layers on, using the Tech Spec defaults.
create or replace function public.create_default_layers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.location_layers (watch_location_id, layer_type, enabled, radius_miles, min_magnitude)
  values
    (new.id, 'weather', true, null, null),
    (new.id, 'wildfire', true, 25, null),
    (new.id, 'earthquake', true, 100, 2.5),
    (new.id, 'air_quality', true, null, null)
  on conflict (watch_location_id, layer_type) do nothing;
  return new;
end;
$$;

create trigger watch_locations_create_default_layers
  after insert on public.watch_locations
  for each row execute function public.create_default_layers();

-- ---------------------------------------------------------------------------
-- notification_rules
-- ---------------------------------------------------------------------------
create table public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  watch_location_id uuid not null references public.watch_locations(id) on delete cascade,
  layer_type public.notification_layer_type not null,
  condition_type public.condition_type not null,
  threshold_value numeric(8, 2),
  channel public.notification_channel not null default 'both',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watch_location_id, layer_type, condition_type),
  check (
    (condition_type = 'any_active' and threshold_value is null)
    or (condition_type <> 'any_active' and threshold_value is not null)
  ),
  check (
    (layer_type = 'wildfire' and condition_type = 'distance_threshold_miles')
    or (layer_type = 'earthquake' and condition_type = 'magnitude_threshold')
    or (layer_type = 'air_quality' and condition_type = 'aqi_threshold')
    or (layer_type in ('official_alerts', 'weather') and condition_type = 'any_active')
  )
);

create index notification_rules_watch_location_id_idx on public.notification_rules (watch_location_id);

create trigger notification_rules_set_updated_at
  before update on public.notification_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- cached_hazard_events — shared, read-only reference data written only by the worker
-- ---------------------------------------------------------------------------
create table public.cached_hazard_events (
  id uuid primary key default gen_random_uuid(),
  source public.hazard_source not null,
  external_id text not null,
  event_type text not null,
  title text not null,
  description text,
  severity text,
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  geometry extensions.geography(Geometry, 4326),
  magnitude numeric(4, 2),
  aqi integer,
  occurred_at timestamptz,
  attributes jsonb not null default '{}'::jsonb,
  raw_payload jsonb,
  geog extensions.geography(Point, 4326) generated always as (
    case
      when latitude is null or longitude is null then null
      else extensions.st_setsrid(extensions.st_makepoint(longitude::double precision, latitude::double precision), 4326)::extensions.geography
    end
  ) stored,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (source, external_id)
);

create index cached_hazard_events_source_fetched_at_idx on public.cached_hazard_events (source, fetched_at desc);
create index cached_hazard_events_event_type_expires_idx on public.cached_hazard_events (event_type, expires_at);
create index cached_hazard_events_event_type_latlng_idx on public.cached_hazard_events (event_type, latitude, longitude);
create index cached_hazard_events_geog_idx on public.cached_hazard_events using gist (geog);
create index cached_hazard_events_geometry_idx on public.cached_hazard_events using gist (geometry);

-- ---------------------------------------------------------------------------
-- cached_weather — one row per NWS grid cell the worker polls
-- ---------------------------------------------------------------------------
create table public.cached_weather (
  id uuid primary key default gen_random_uuid(),
  grid_key text not null unique,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  city_name text,
  state text,
  time_zone text,
  current jsonb,
  hourly jsonb not null default '[]'::jsonb,
  daily jsonb not null default '[]'::jsonb,
  source public.hazard_source not null default 'nws',
  geog extensions.geography(Point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(longitude::double precision, latitude::double precision), 4326)::extensions.geography
  ) stored,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz
);

create index cached_weather_geog_idx on public.cached_weather using gist (geog);

-- ---------------------------------------------------------------------------
-- notifications_log
-- ---------------------------------------------------------------------------
create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  watch_location_id uuid references public.watch_locations(id) on delete set null,
  notification_rule_id uuid references public.notification_rules(id) on delete set null,
  hazard_event_id uuid references public.cached_hazard_events(id) on delete set null,
  layer_type public.notification_layer_type,
  summary text not null,
  channel public.delivery_channel not null,
  sent_at timestamptz not null default now()
);

create index notifications_log_user_sent_idx on public.notifications_log (user_id, sent_at desc);
create index notifications_log_rule_event_idx on public.notifications_log (notification_rule_id, hazard_event_id);
create index notifications_log_rule_sent_idx on public.notifications_log (notification_rule_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- push_subscriptions — Web Push endpoints registered by the browser
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  failure_count integer not null default 0
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- poller_runs — heartbeat / observability for the worker (Launch Checklist: Monitoring)
-- ---------------------------------------------------------------------------
create table public.poller_runs (
  id bigint generated always as identity primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'error')),
  rows_upserted integer not null default 0,
  error text,
  details jsonb not null default '{}'::jsonb
);

create index poller_runs_source_started_idx on public.poller_runs (source, started_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.watch_locations enable row level security;
alter table public.location_layers enable row level security;
alter table public.notification_rules enable row level security;
alter table public.notifications_log enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.cached_hazard_events enable row level security;
alter table public.cached_weather enable row level security;
alter table public.poller_runs enable row level security;

create policy "users manage their own watch locations"
  on public.watch_locations for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage layers of their own locations"
  on public.location_layers for all to authenticated
  using (exists (select 1 from public.watch_locations wl where wl.id = watch_location_id and wl.user_id = auth.uid()))
  with check (exists (select 1 from public.watch_locations wl where wl.id = watch_location_id and wl.user_id = auth.uid()));

create policy "users manage rules of their own locations"
  on public.notification_rules for all to authenticated
  using (exists (select 1 from public.watch_locations wl where wl.id = watch_location_id and wl.user_id = auth.uid()))
  with check (exists (select 1 from public.watch_locations wl where wl.id = watch_location_id and wl.user_id = auth.uid()));

create policy "users read their own notification history"
  on public.notifications_log for select to authenticated
  using (auth.uid() = user_id);

create policy "users manage their own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Hazard caches are public, read-only reference data. Writes happen only through the
-- service-role key (which bypasses RLS) from the worker.
create policy "anyone can read cached hazard events"
  on public.cached_hazard_events for select to anon, authenticated
  using (true);

create policy "anyone can read cached weather"
  on public.cached_weather for select to anon, authenticated
  using (true);

-- poller_runs: no policies → only the service role can read/write.

-- ---------------------------------------------------------------------------
-- Proximity / aggregation functions (read side; see docs/AllClear-API_DESIGN.md §5)
-- ---------------------------------------------------------------------------

-- Events of the given types within N miles of a point, nearest first.
create or replace function public.hazards_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles double precision,
  p_event_types text[],
  p_limit integer default 200
)
returns table (
  id uuid,
  source public.hazard_source,
  external_id text,
  event_type text,
  title text,
  description text,
  severity text,
  latitude numeric,
  longitude numeric,
  magnitude numeric,
  aqi integer,
  occurred_at timestamptz,
  attributes jsonb,
  fetched_at timestamptz,
  expires_at timestamptz,
  distance_miles double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with pt as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    e.id, e.source, e.external_id, e.event_type, e.title, e.description, e.severity,
    e.latitude, e.longitude, e.magnitude, e.aqi, e.occurred_at, e.attributes,
    e.fetched_at, e.expires_at,
    st_distance(e.geog, pt.g) / 1609.344 as distance_miles
  from public.cached_hazard_events e, pt
  where e.event_type = any (p_event_types)
    and e.geog is not null
    and (e.expires_at is null or e.expires_at > now())
    and st_dwithin(e.geog, pt.g, p_radius_miles * 1609.344)
  order by distance_miles asc
  limit greatest(1, least(p_limit, 1000));
$$;

-- Active official alerts affecting a point: polygon alerts by intersection, zone-based alerts
-- (polled per grid cell, stored as a point) within 8 miles.
create or replace function public.alerts_for_point(
  p_lat double precision,
  p_lng double precision
)
returns table (
  id uuid,
  source public.hazard_source,
  external_id text,
  event_type text,
  title text,
  description text,
  severity text,
  latitude numeric,
  longitude numeric,
  magnitude numeric,
  aqi integer,
  occurred_at timestamptz,
  attributes jsonb,
  fetched_at timestamptz,
  expires_at timestamptz,
  distance_miles double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with pt as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    e.id, e.source, e.external_id, e.event_type, e.title, e.description, e.severity,
    e.latitude, e.longitude, e.magnitude, e.aqi, e.occurred_at, e.attributes,
    e.fetched_at, e.expires_at,
    coalesce(st_distance(e.geog, pt.g), 0) / 1609.344 as distance_miles
  from public.cached_hazard_events e, pt
  where e.event_type = 'severe_alert'
    and (e.expires_at is null or e.expires_at > now())
    and (
      (e.geometry is not null and st_intersects(e.geometry, pt.g))
      or (e.geometry is null and e.geog is not null and st_dwithin(e.geog, pt.g, 8 * 1609.344))
    )
  order by
    case e.severity when 'Extreme' then 0 when 'Severe' then 1 when 'Moderate' then 2 when 'Minor' then 3 else 4 end,
    e.occurred_at desc nulls last;
$$;

-- Point events inside a bounding box (national map).
create or replace function public.hazards_in_bbox(
  p_min_lng double precision,
  p_min_lat double precision,
  p_max_lng double precision,
  p_max_lat double precision,
  p_event_types text[],
  p_limit integer default 2000
)
returns table (
  id uuid,
  source public.hazard_source,
  event_type text,
  title text,
  severity text,
  latitude numeric,
  longitude numeric,
  magnitude numeric,
  occurred_at timestamptz,
  attributes jsonb,
  fetched_at timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    e.id, e.source, e.event_type, e.title, e.severity, e.latitude, e.longitude,
    e.magnitude, e.occurred_at, e.attributes, e.fetched_at
  from public.cached_hazard_events e
  where e.event_type = any (p_event_types)
    and e.latitude is not null and e.longitude is not null
    and (e.expires_at is null or e.expires_at > now())
    and e.latitude between p_min_lat and p_max_lat
    and e.longitude between p_min_lng and p_max_lng
  order by coalesce(e.magnitude, 0) desc, e.occurred_at desc nulls last
  limit greatest(1, least(p_limit, 5000));
$$;

-- Nearest cached NWS weather row to a point.
create or replace function public.nearest_weather(
  p_lat double precision,
  p_lng double precision,
  p_max_miles double precision default 10
)
returns table (
  id uuid,
  grid_key text,
  latitude numeric,
  longitude numeric,
  city_name text,
  state text,
  time_zone text,
  current jsonb,
  hourly jsonb,
  daily jsonb,
  source public.hazard_source,
  fetched_at timestamptz,
  expires_at timestamptz,
  distance_miles double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with pt as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    w.id, w.grid_key, w.latitude, w.longitude, w.city_name, w.state, w.time_zone,
    w.current, w.hourly, w.daily, w.source, w.fetched_at, w.expires_at,
    st_distance(w.geog, pt.g) / 1609.344 as distance_miles
  from public.cached_weather w, pt
  where st_dwithin(w.geog, pt.g, p_max_miles * 1609.344)
  order by w.geog <-> pt.g
  limit 1;
$$;

-- One-query dashboard: per Watch Location of the calling user, a compact hazard summary.
-- RLS on watch_locations scopes this to auth.uid().
create or replace function public.dashboard_summary()
returns table (
  location_id uuid,
  fire_count integer,
  incident_count integer,
  quake_count integer,
  max_quake_magnitude numeric,
  aqi integer,
  alert_count integer,
  top_alert_event text,
  top_alert_severity text,
  weather_current jsonb,
  weather_fetched_at timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with locs as (
    select
      wl.id,
      wl.latitude::double precision as lat,
      wl.longitude::double precision as lng,
      wl.geog,
      coalesce((select ll.enabled from public.location_layers ll where ll.watch_location_id = wl.id and ll.layer_type = 'wildfire'), true) as wildfire_enabled,
      coalesce((select ll.radius_miles from public.location_layers ll where ll.watch_location_id = wl.id and ll.layer_type = 'wildfire'), 25)::double precision as wildfire_radius,
      coalesce((select ll.enabled from public.location_layers ll where ll.watch_location_id = wl.id and ll.layer_type = 'earthquake'), true) as earthquake_enabled,
      coalesce((select ll.radius_miles from public.location_layers ll where ll.watch_location_id = wl.id and ll.layer_type = 'earthquake'), 100)::double precision as earthquake_radius,
      coalesce((select ll.min_magnitude from public.location_layers ll where ll.watch_location_id = wl.id and ll.layer_type = 'earthquake'), 2.5) as min_magnitude,
      coalesce((select ll.enabled from public.location_layers ll where ll.watch_location_id = wl.id and ll.layer_type = 'air_quality'), true) as air_quality_enabled,
      coalesce((select ll.enabled from public.location_layers ll where ll.watch_location_id = wl.id and ll.layer_type = 'weather'), true) as weather_enabled
    from public.watch_locations wl
  )
  select
    l.id as location_id,
    case when l.wildfire_enabled then (
      select count(*)::integer from public.cached_hazard_events e
      where e.event_type = 'fire_hotspot' and e.geog is not null
        and (e.expires_at is null or e.expires_at > now())
        and st_dwithin(e.geog, l.geog, l.wildfire_radius * 1609.344)
    ) else 0 end as fire_count,
    case when l.wildfire_enabled then (
      select count(*)::integer from public.cached_hazard_events e
      where e.event_type = 'fire_incident' and e.geog is not null
        and (e.expires_at is null or e.expires_at > now())
        and st_dwithin(e.geog, l.geog, l.wildfire_radius * 1609.344)
    ) else 0 end as incident_count,
    case when l.earthquake_enabled then (
      select count(*)::integer from public.cached_hazard_events e
      where e.event_type = 'earthquake' and e.geog is not null
        and (e.expires_at is null or e.expires_at > now())
        and e.magnitude >= l.min_magnitude
        and st_dwithin(e.geog, l.geog, l.earthquake_radius * 1609.344)
    ) else 0 end as quake_count,
    case when l.earthquake_enabled then (
      select max(e.magnitude) from public.cached_hazard_events e
      where e.event_type = 'earthquake' and e.geog is not null
        and (e.expires_at is null or e.expires_at > now())
        and e.magnitude >= l.min_magnitude
        and st_dwithin(e.geog, l.geog, l.earthquake_radius * 1609.344)
    ) else null end as max_quake_magnitude,
    case when l.air_quality_enabled then (
      select e.aqi from public.cached_hazard_events e
      where e.event_type = 'aqi_reading' and e.geog is not null
        and (e.expires_at is null or e.expires_at > now())
        and st_dwithin(e.geog, l.geog, 30 * 1609.344)
      order by e.geog <-> l.geog
      limit 1
    ) else null end as aqi,
    (select count(*)::integer from public.alerts_for_point(l.lat, l.lng)) as alert_count,
    (select a.title from public.alerts_for_point(l.lat, l.lng) a limit 1) as top_alert_event,
    (select a.severity from public.alerts_for_point(l.lat, l.lng) a limit 1) as top_alert_severity,
    case when l.weather_enabled then (select w.current from public.nearest_weather(l.lat, l.lng, 10) w) else null end as weather_current,
    case when l.weather_enabled then (select w.fetched_at from public.nearest_weather(l.lat, l.lng, 10) w) else null end as weather_fetched_at
  from locs l;
$$;

-- Latest successful run per source, for the worker's /health endpoint and alerting.
create or replace function public.latest_source_freshness()
returns table (source text, last_success_at timestamptz, last_status text)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.source,
    (select max(r.finished_at) from public.poller_runs r where r.source = s.source and r.status = 'success') as last_success_at,
    (select r.status from public.poller_runs r where r.source = s.source order by r.started_at desc limit 1) as last_status
  from (select distinct source from public.poller_runs) s;
$$;

revoke execute on function public.latest_source_freshness() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grants (Supabase default privileges normally cover these; explicit for clarity)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select on public.cached_hazard_events, public.cached_weather to anon, authenticated;
grant all on public.watch_locations, public.location_layers, public.notification_rules, public.push_subscriptions to authenticated;
grant select on public.notifications_log to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.hazards_near(double precision, double precision, double precision, text[], integer) to anon, authenticated, service_role;
grant execute on function public.alerts_for_point(double precision, double precision) to anon, authenticated, service_role;
grant execute on function public.hazards_in_bbox(double precision, double precision, double precision, double precision, text[], integer) to anon, authenticated, service_role;
grant execute on function public.nearest_weather(double precision, double precision, double precision) to anon, authenticated, service_role;
grant execute on function public.dashboard_summary() to authenticated, service_role;
grant execute on function public.latest_source_freshness() to service_role;
