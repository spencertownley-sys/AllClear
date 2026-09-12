-- Layers v2: postal code (EPA UV index is served by ZIP), per-rule notification frequency,
-- and polygon read RPCs for fire perimeters (active + historical).

alter table public.watch_locations
  add column if not exists postal_code text
  check (postal_code is null or char_length(postal_code) between 3 and 12);

alter table public.notification_rules
  add column if not exists min_interval_minutes integer
  check (min_interval_minutes is null or min_interval_minutes between 15 and 10080);

-- Polygon events (fire perimeters) within N miles of a point, measured to the nearest edge.
create or replace function public.perimeters_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles double precision,
  p_event_types text[],
  p_limit integer default 50
)
returns table (
  id uuid,
  source public.hazard_source,
  external_id text,
  event_type text,
  title text,
  severity text,
  occurred_at timestamptz,
  attributes jsonb,
  fetched_at timestamptz,
  expires_at timestamptz,
  distance_miles double precision,
  geojson jsonb
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
    e.id, e.source, e.external_id, e.event_type, e.title, e.severity, e.occurred_at, e.attributes,
    e.fetched_at, e.expires_at,
    st_distance(e.geometry, pt.g) / 1609.344 as distance_miles,
    st_asgeojson(e.geometry, 5)::jsonb as geojson
  from public.cached_hazard_events e, pt
  where e.event_type = any (p_event_types)
    and e.geometry is not null
    and (e.expires_at is null or e.expires_at > now())
    and st_dwithin(e.geometry, pt.g, p_radius_miles * 1609.344)
  order by distance_miles asc, (e.attributes->>'acres')::numeric desc nulls last
  limit greatest(1, least(p_limit, 500));
$$;

-- Polygon events intersecting a bounding box (national map).
create or replace function public.hazard_polygons_in_bbox(
  p_min_lng double precision,
  p_min_lat double precision,
  p_max_lng double precision,
  p_max_lat double precision,
  p_event_types text[],
  p_limit integer default 500
)
returns table (
  id uuid,
  source public.hazard_source,
  event_type text,
  title text,
  attributes jsonb,
  fetched_at timestamptz,
  geojson jsonb
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    e.id, e.source, e.event_type, e.title, e.attributes, e.fetched_at,
    st_asgeojson(e.geometry, 4)::jsonb as geojson
  from public.cached_hazard_events e
  where e.event_type = any (p_event_types)
    and e.geometry is not null
    and (e.expires_at is null or e.expires_at > now())
    and st_intersects(e.geometry, st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography)
  order by (e.attributes->>'acres')::numeric desc nulls last
  limit greatest(1, least(p_limit, 2000));
$$;

grant execute on function public.perimeters_near(double precision, double precision, double precision, text[], integer) to anon, authenticated, service_role;
grant execute on function public.hazard_polygons_in_bbox(double precision, double precision, double precision, double precision, text[], integer) to anon, authenticated, service_role;
