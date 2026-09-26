-- Weather v3: extended (16-day) forecast and CPC weekly outlooks live alongside the NWS row per cell.
alter table public.cached_weather
  add column if not exists extended_hourly jsonb,
  add column if not exists extended_daily jsonb,
  add column if not exists extended_fetched_at timestamptz,
  add column if not exists outlook jsonb,
  add column if not exists outlook_fetched_at timestamptz;

-- nearest_weather returns the new columns; the return type changes so the function is recreated.
drop function if exists public.nearest_weather(double precision, double precision, double precision);

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
  extended_hourly jsonb,
  extended_daily jsonb,
  extended_fetched_at timestamptz,
  outlook jsonb,
  outlook_fetched_at timestamptz,
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
    w.extended_hourly, w.extended_daily, w.extended_fetched_at, w.outlook, w.outlook_fetched_at,
    st_distance(w.geog, pt.g) / 1609.344 as distance_miles
  from public.cached_weather w, pt
  where st_dwithin(w.geog, pt.g, p_max_miles * 1609.344)
  order by w.geog <-> pt.g
  limit 1;
$$;

grant execute on function public.nearest_weather(double precision, double precision, double precision) to anon, authenticated, service_role;
