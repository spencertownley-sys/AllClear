import 'server-only';
import { ApiError, type BBox, type GeoJsonGeometry, type HazardSource, type MapFireDTO, type MapPerimeterDTO, type MapQuakeDTO, type MapResponse, type StormDTO } from '@allclear/shared';
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

export async function getMapData(
  supabase: ServerSupabaseClient,
  bbox: BBox,
  layers: { fires: boolean; quakes: boolean; perimeters: boolean; storms: boolean },
): Promise<MapResponse> {
  const types: string[] = [];
  if (layers.fires) types.push('fire_hotspot', 'fire_incident');
  if (layers.quakes) types.push('earthquake');
  if (layers.storms) types.push('tropical_cyclone');

  const polygonsPromise: Promise<PolyRow[]> = layers.perimeters
    ? Promise.resolve(supabase
        .rpc('hazard_polygons_in_bbox', {
          p_min_lng: bbox.minLng,
          p_min_lat: bbox.minLat,
          p_max_lng: bbox.maxLng,
          p_max_lat: bbox.maxLat,
          p_event_types: ['fire_perimeter'],
          p_limit: 400,
        })
        .then(({ data, error }) => {
          if (error) {
            console.error('[map] hazard_polygons_in_bbox failed', error.message);
            throw new ApiError('INTERNAL_ERROR', 'Could not load map data');
          }
          return (data ?? []) as PolyRow[];
        }))
    : Promise.resolve([]);

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

  const polygons = await polygonsPromise;
  const fires: MapFireDTO[] = [];
  const quakes: MapQuakeDTO[] = [];
  const storms: StormDTO[] = [];
  let firesUpdated: string | null = null;
  let quakesUpdated: string | null = null;
  let stormsUpdated: string | null = null;
  let perimetersUpdated: string | null = null;

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
    data: { fires, quakes, perimeters, storms },
    meta: { fires_updated_at: firesUpdated, quakes_updated_at: quakesUpdated, perimeters_updated_at: perimetersUpdated, storms_updated_at: stormsUpdated },
  };
}
