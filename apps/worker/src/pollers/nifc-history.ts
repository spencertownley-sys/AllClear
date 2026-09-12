import { FIRE_HISTORY_YEARS, bboxAround, type Json } from '@allclear/shared';
import { fetchJson } from '../http';
import { bboxCenter, geojsonToEwkt, vertexCount } from '../geojson';
import { cellsFor, type Cell } from '../cells';
import { getWatchLocations, upsertEvents, type EventInsert } from '../db';
import { log, errorFields } from '../logger';
import { displayFireName } from './nifc-perimeters';
import type { Poller, PollerContext } from './types';

/** NIFC "InterAgency Fire Perimeter History — All Years" (public ArcGIS feature service). */
export const DEFAULT_HISTORY_URL =
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/InterAgencyFirePerimeterHistory_All_Years_View/FeatureServer/0/query';
const PER_CELL = 150;
const TTL_DAYS = 30;
const MAX_VERTICES = 8_000;
/** Cells are ~35 mi across; fetch a box wide enough to cover any watch radius up to 100 mi. */
const CELL_REACH_MILES = 120;

export interface HistoryFeature {
  geometry: { type: string; coordinates: unknown } | null;
  properties: {
    OBJECTID?: number;
    INCIDENT?: string | null;
    FIRE_YEAR_INT?: number | null;
    GIS_ACRES?: number | null;
    UNQE_FIRE_ID?: string | null;
  };
}

export function normalizeHistory(feature: HistoryFeature, now: Date): EventInsert | null {
  const p = feature.properties;
  if (!feature.geometry || p.OBJECTID === undefined) return null;
  if (vertexCount(feature.geometry) > MAX_VERTICES) return null;
  const geometry = geojsonToEwkt(feature.geometry);
  const center = bboxCenter(feature.geometry);
  if (!geometry || !center) return null;
  const year = typeof p.FIRE_YEAR_INT === 'number' ? p.FIRE_YEAR_INT : null;
  return {
    source: 'inciweb',
    external_id: `nifc-hist:${p.OBJECTID}`,
    event_type: 'fire_perimeter_historical',
    title: displayFireName(p.INCIDENT?.trim() || 'Unnamed fire'),
    severity: null,
    latitude: center.latitude,
    longitude: center.longitude,
    geometry,
    occurred_at: year ? `${year}-07-01T00:00:00.000Z` : null,
    attributes: {
      year,
      acres: typeof p.GIS_ACRES === 'number' ? Math.round(p.GIS_ACRES) : null,
      unique_id: p.UNQE_FIRE_ID ?? null,
      provider: 'nifc-history',
    },
    raw_payload: p as unknown as Json,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + TTL_DAYS * 86_400_000).toISOString(),
  };
}

async function fetchCell(base: string, cell: Cell, sinceYear: number, now: Date): Promise<EventInsert[]> {
  const box = bboxAround(cell, CELL_REACH_MILES);
  const url = new URL(base);
  url.searchParams.set('where', `FIRE_YEAR_INT >= ${sinceYear}`);
  url.searchParams.set('geometry', `${box.minLng},${box.minLat},${box.maxLng},${box.maxLat}`);
  url.searchParams.set('geometryType', 'esriGeometryEnvelope');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('outFields', 'OBJECTID,INCIDENT,FIRE_YEAR_INT,GIS_ACRES,UNQE_FIRE_ID');
  url.searchParams.set('orderByFields', 'GIS_ACRES DESC');
  url.searchParams.set('resultRecordCount', String(PER_CELL));
  url.searchParams.set('f', 'geojson');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('geometryPrecision', '4');
  url.searchParams.set('maxAllowableOffset', '0.002');
  const data = await fetchJson<{ features?: HistoryFeature[]; error?: { message: string } }>(url.toString(), { timeoutMs: 90_000 });
  if (data.error) throw new Error(`NIFC history error: ${data.error.message}`);
  return (data.features ?? []).map((f) => normalizeHistory(f, now)).filter((r): r is EventInsert => r !== null);
}

export const nifcHistoryPoller: Poller = {
  name: 'nifc_history',
  layers: [],
  intervalMinutes: (c) => c.POLL_NIFC_HISTORY_MINUTES,
  disabledReason: () => null,
  async run({ sb, config, now }: PollerContext) {
    const locations = await getWatchLocations(sb);
    const cells = cellsFor(locations, 'history', 'wildfire').slice(0, config.MAX_CELLS_PER_RUN);
    const sinceYear = now.getUTCFullYear() - FIRE_HISTORY_YEARS;
    const rows = new Map<string, EventInsert>();
    let failedCells = 0;
    for (const cell of cells) {
      try {
        for (const row of await fetchCell(config.NIFC_HISTORY_URL || DEFAULT_HISTORY_URL, cell, sinceYear, now)) rows.set(row.external_id, row);
      } catch (error) {
        failedCells += 1;
        log.warn('nifc history cell failed', { cell: cell.key, ...errorFields(error) });
      }
    }
    if (cells.length > 0 && failedCells === cells.length) throw new Error('Every NIFC history cell failed');
    const written = await upsertEvents(sb, Array.from(rows.values()));
    return { rows: written, details: { cells: cells.length, failedCells, sinceYear } };
  },
};
