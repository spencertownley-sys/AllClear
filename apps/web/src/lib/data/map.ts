import 'server-only';
import { ApiError, FIRE_HISTORY_YEARS, type BBox, type GeoJsonGeometry, type HazardSource, type MapFireDTO, type MapHistoryDTO, type MapPerimeterDTO, type MapQuakeDTO, type MapResponse, type StormDTO } from '@allclear/shared';
import type { ServerSupabaseClient } from '@/lib/supabase/server';

type BboxRow = {
  id: string;
  source: HazardSource;
  event_type: string;
  title: string;
  severity: string | null;
  latitude: number;
  longitude: number;
  magnitude: number | null;
  occurred_at: string | null;
  attributes: unknown;
  fetched_at: string;
};

const MAX_MARKERS = 2500;

type PolyRow = {
  id: string;
  source: MapPerimeterDTO['source'];
  event_type: string;
  title: string;
  attributes: unknown;
  fetched_at: string;
  geojson: unknown;
};

function a(row: { attributes: unknown }): Record<string, unknown> {
  return row.attributes && typeof row.attributes === 'object' ? (row.attributes as Record<string, unknown>) : {};
}

async function fetchPolygons(
  supabase: ServerSupabaseClient,
  bbox: BBox,
  eventTypes: string[],
  limit: number,
  minYear: number | null,
): Promise<PolyRow[]> {
  const { data, error } = await supabase.rpc('hazard_polygons_in_bbox', {
    p_min_lng: bbox.minLng,
    p_min_lat: bbox.minLat,
    p_max_lng: bbox.maxLng,
    p_max_lat: bbox.maxLat,
    p_event_types: eventTypes,
    p_limit: limit,
    p_min_year: minYear,
  });
  if (error) {
    console.error('[map] hazard_polygons_in_bbox failed', error.message);
    throw new ApiError('INTERNAL_ERROR', 'Could not load map data');
  }
  return (data ?? []) as PolyRow[];
}

export async function getMapData(
  supabase: ServerSupabaseClient,
  bbox: BBox,
  layers: { fires: boolean; quakes: boolean; perimeters: boolean; storms: boolean; history: boolean },
  historyYears: number = FIRE_HISTORY_YEARS,
): Promise<MapResponse> {
  const types: string[] = [];
  if (layers.fires) types.push('fire_hotspot', 'fire_incident');
  if (layers.quakes) types.push('earthquake');
  if (layers.storms) types.push('tropical_cyclone');

  const polygonsPromise: Promise<PolyRow[]> = layers.perimeters ? fetchPolygons(supabase, bbox, ['fire_perimeter'], 400, null) : Promise.resolve([]);
  // Largest fires first (the RPC orders by acres), so a national view shows the big ones and zooming in fills in the rest.
  const minYear = new Date().getUTCFullYear() - historyYears;
  const historyPromise: Promise<PolyRow[]> = layers.history ? fetchPolygons(supabase, bbox, ['fire_perimeter_historical'], 400, minYear) : Promise.resolve([]);

  const rows: BboxRow[] = types.length
    ? await (async () => {
        const { data, error } = await supabase.rpc('hazards_in_bbox', {
          p_min_lng: bbox.minLng,
          p_min_lat: bbox.minLat,
          p_max_lng: bbox.maxLng,
          p_max_lat: bbox.maxLat,
          p_event_types: types,
          p_limit: MAX_MARKERS,
        });
        if (error) {
          console.error('[map] hazards_in_bbox failed', error.message);
          throw new ApiError('INTERNAL_ERROR', 'Could not load map data');
        }
        return (data ?? []) as BboxRow[];
      })()
    : [];

  const [polygons, historyRows] = await Promise.all([polygonsPromise, historyPromise]);
  const fires: MapFireDTO[] = [];
  const quakes: MapQuakeDTO[] = [];
  const storms: StormDTO[] = [];
  let firesUpdated: string | null = null;
  let quakesUpdated: string | null = null;
  let stormsUpdated: string | null = null;
  let perimetersUpdated: string | null = null;
  let historyUpdated: string | null = null;

  const history: MapHistoryDTO[] = historyRows.map((row) => {
    const attrs = a(row);
    if (!historyUpdated || row.fetched_at > historyUpdated) historyUpdated = row.fetched_at;
    return {
      id: row.id,
      name: row.title,
      year: typeof attrs.year === 'number' ? attrs.year : null,
      acres: typeof attrs.acres === 'number' ? attrs.acres : null,
      geojson: row.geojson as GeoJsonGeometry,
      source: row.source,
    };
  });

  const perimeters: MapPerimeterDTO[] = polygons.map((row) => {
    const attrs = a(row);
    if (!perimetersUpdated || row.fetched_at > perimetersUpdated) perimetersUpdated = row.fetched_at;
    return {
      id: row.id,
      name: row.title,
      acres: typeof attrs.acres === 'number' ? attrs.acres : null,
      containment_pct: typeof attrs.containment_pct === 'number' ? attrs.containment_pct : null,
      updated_at: typeof attrs.updated_at === 'string' ? attrs.updated_at : row.fetched_at,
      geojson: row.geojson as GeoJsonGeometry,
      source: row.source,
    };
  });

  for (const row of rows) {
    const a = (row.attributes && typeof row.attributes === 'object' ? row.attributes : {}) as Record<string, unknown>;
    if (row.event_type === 'tropical_cyclone') {
      storms.push({
        id: row.id,
        name: typeof a.name === 'string' ? a.name : row.title,
        classification: typeof a.classification === 'string' ? a.classification : (row.severity ?? 'TC'),
        intensity_kt: typeof a.intensity_kt === 'number' ? a.intensity_kt : null,
        pressure_mb: typeof a.pressure_mb === 'number' ? a.pressure_mb : null,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        movement_dir: typeof a.movement_dir === 'number' ? a.movement_dir : null,
        movement_mph: typeof a.movement_mph === 'number' ? a.movement_mph : null,
        distance_miles: null,
        last_update: row.occurred_at,
        url: typeof a.url === 'string' ? a.url : null,
        source: row.source,
      });
      if (!stormsUpdated || row.fetched_at > stormsUpdated) stormsUpdated = row.fetched_at;
      continue;
    }
    if (row.event_type === 'earthquake') {
      quakes.push({
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        magnitude: Number(row.magnitude ?? 0),
        place: typeof a.place === 'string' ? a.place : row.title,
        occurred_at: row.occurred_at ?? row.fetched_at,
        source: row.source,
      });
      if (!quakesUpdated || row.fetched_at > quakesUpdated) quakesUpdated = row.fetched_at;
    } else {
      const isIncident = row.event_type === 'fire_incident';
      fires.push({
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        detected_at: row.occurred_at,
        source: row.source,
        kind: isIncident ? 'incident' : 'hotspot',
        ...(isIncident
          ? {
              name: row.title,
              containment_pct: typeof a.containment_pct === 'number' ? a.containment_pct : null,
              acres: typeof a.acres === 'number' ? a.acres : null,
            }
          : {}),
      });
      if (!firesUpdated || row.fetched_at > firesUpdated) firesUpdated = row.fetched_at;
    }
  }

  return {
    data: { fires, quakes, perimeters, storms, history },
    meta: { fires_updated_at: firesUpdated, quakes_updated_at: quakesUpdated, perimeters_updated_at: perimetersUpdated, storms_updated_at: stormsUpdated,
      history_updated_at: historyUpdated,
      history_years: historyYears,
    },
  };
}
