-- Development seed: a handful of fake hazard rows near Seattle and Denver so the dashboard
-- has something to show before the worker has run. Never apply to production.

insert into public.cached_hazard_events (source, external_id, event_type, title, description, severity, latitude, longitude, magnitude, aqi, occurred_at, attributes, fetched_at, expires_at)
values
  ('firms', 'seed:hotspot:1', 'fire_hotspot', 'Satellite hotspot', null, null, 47.72, -122.05, null, null, now() - interval '2 hours', '{"confidence":"nominal","satellite":"VIIRS_SNPP_NRT"}', now(), now() + interval '1 day'),
  ('inciweb', 'seed:incident:1', 'fire_incident', 'Bear Creek Fire', 'Seed incident for local development.', null, 47.80, -121.95, null, null, now() - interval '3 days', '{"containment_pct":40,"acres":1200,"status":"Active","url":"https://inciweb.wildfire.gov/"}', now(), now() + interval '1 day'),
  ('usgs', 'seed:quake:1', 'earthquake', 'M 3.2 - 12 km NE of Bremerton, WA', null, null, 47.65, -122.55, 3.2, null, now() - interval '6 hours', '{"place":"12 km NE of Bremerton, WA","url":"https://earthquake.usgs.gov/"}', now(), now() + interval '7 days'),
  ('airnow', 'seed:aqi:seattle', 'aqi_reading', 'AQI 38 (Good)', null, 'Good', 47.6, -122.3, null, 38, now() - interval '30 minutes', '{"pollutant":"PM2.5","reporting_area":"Seattle-Bellevue-Kent Valley","category":"Good"}', now(), now() + interval '3 hours'),
  ('airnow', 'seed:aqi:denver', 'aqi_reading', 'AQI 142 (Unhealthy for Sensitive Groups)', null, 'Unhealthy for Sensitive Groups', 39.7, -105.0, null, 142, now() - interval '30 minutes', '{"pollutant":"O3","reporting_area":"Denver","category":"Unhealthy for Sensitive Groups"}', now(), now() + interval '3 hours'),
  ('nws', 'seed:alert:1', 'severe_alert', 'Red Flag Warning', 'Seed alert: critical fire weather conditions expected.', 'Severe', 47.6, -122.3, null, null, now() - interval '1 hour', '{"headline":"Red Flag Warning issued","urgency":"Expected","instruction":"Avoid outdoor burning.","sender":"NWS Seattle WA"}', now(), now() + interval '12 hours')
on conflict (source, external_id) do update set fetched_at = excluded.fetched_at, expires_at = excluded.expires_at;

insert into public.cached_weather (grid_key, latitude, longitude, city_name, state, time_zone, current, hourly, daily, fetched_at, expires_at)
values (
  '47.6,-122.35', 47.6, -122.35, 'Seattle', 'WA', 'America/Los_Angeles',
  '{"temp_f":62,"conditions":"Cloudy","humidity_pct":71,"wind_mph":5,"icon":null,"observed_at":null,"station":"KBFI","basis":"observation"}',
  '[{"time":"2026-09-12T10:00:00-07:00","temp_f":61,"conditions":"Cloudy","precip_pct":10,"icon":null},{"time":"2026-09-12T11:00:00-07:00","temp_f":63,"conditions":"Partly Sunny","precip_pct":5,"icon":null}]',
  '[{"date":"2026-09-12","name":"Today","high_f":68,"low_f":54,"conditions":"Cloudy then Sunny","precip_pct":10,"icon":null,"detailed":"Cloudy, then gradually becoming sunny."},{"date":"2026-09-13","name":"Sunday","high_f":71,"low_f":55,"conditions":"Sunny","precip_pct":0,"icon":null,"detailed":"Sunny, with a high near 71."}]',
  now(), now() + interval '1 hour'
)
on conflict (grid_key) do update set fetched_at = excluded.fetched_at, expires_at = excluded.expires_at;
