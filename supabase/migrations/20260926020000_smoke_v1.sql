-- Wildfire smoke plume overlay: NOAA/NESDIS Hazard Mapping System (HMS) satellite smoke analysis.
-- Stored as ordinary cached_hazard_events rows (event_type 'smoke_plume', a polygon geometry, and
-- density/satellite/observation-window in attributes), reusing perimeters_near / hazard_polygons_in_bbox —
-- no RPC changes needed. Only the source enum needs a new value.
alter type public.hazard_source add value if not exists 'nesdis';
