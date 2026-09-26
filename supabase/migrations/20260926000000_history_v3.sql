-- Fire history v3: a user-selectable look-back (up to 25 years) on the public map and location detail.
-- Both polygon RPCs gain an optional p_min_year filter on attributes->>'year'. The signatures change,
-- so the previous overloads are dropped first: PostgREST cannot choose between two candidates that both
-- match a call, and the web app always passes p_min_year (null when it does not apply).

drop function if exists public.perimeters_near(double precision, double precision, double precision, text[], integer);
drop function if exists public.hazard_polygons_in_bbox(double precision, double precision, double precision, double precision, text[], integer);

create or replace function public.perimeters_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles double precision,
  p_event_types text[],
  p_limit integer default 50,
  p_min_year integer default null
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
    and (p_min_year is null or (e.attributes->>'year')::integer >= p_min_year)
    and st_dwithin(e.geometry, pt.g, p_radius_miles * 1609.344)
  order by distance_miles asc, (e.attributes->>'acres')::numeric desc nulls last
  limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.hazard_polygons_in_bbox(
  p_min_lng double precision,
  p_min_lat double precision,
  p_max_lng double precision,
  p_max_lat double precision,
  p_event_types text[],
  p_limit integer default 500,
  p_min_year integer default null
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
    and (p_min_year is null or (e.attributes->>'year')::integer >= p_min_year)
    and st_intersects(e.geometry, st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography)
  order by (e.attributes->>'acres')::numeric desc nulls last
  limit greatest(1, least(p_limit, 2000));
$$;

grant execute on function public.perimeters_near(double precision, double precision, double precision, text[], integer, integer) to anon, authenticated, service_role;
grant execute on function public.hazard_polygons_in_bbox(double precision, double precision, double precision, double precision, text[], integer, integer) to anon, authenticated, service_role;

-- Year filter on the (small) historical-perimeter subset.
create index if not exists cached_hazard_events_history_year_idx
  on public.cached_hazard_events (((attributes->>'year')::integer))
  where event_type = 'fire_perimeter_historical';
