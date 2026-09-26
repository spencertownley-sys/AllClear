import { FIRE_HISTORY_MAX_YEARS, FIRE_HISTORY_NATIONAL_MIN_ACRES, bboxAround, type Json } from '@allclear/shared';
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
/** Largest fires first; 25 years within reach of a cell can be thousands of small burns. */
const PER_CELL = 300;
const NATIONAL_PAGE = 500;
const NATIONAL_MAX_PAGES = 40;
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

/** NIFC records an unknown year as 9999 (and the odd 0 / 1900); treat anything implausible as unknown. */
export function plausibleYear(value: unknown, now: Date): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value >= 1900 && value <= now.getUTCFullYear() + 1 ? value : null;
}

export function normalizeHistory(feature: HistoryFeature, now: Date): EventInsert | null {
  const p = feature.properties;
  if (!feature.geometry || p.OBJECTID === undefined) return null;
  if (vertexCount(feature.geometry) > MAX_VERTICES) return null;
  const geometry = geojsonToEwkt(feature.geometry);
  const center = bboxCenter(feature.geometry);
  if (!geometry || !center) return null;
  const year = plausibleYear(p.FIRE_YEAR_INT, now);
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
  url.searchParams.set('where', yearWindow(sinceYear, now));
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

/** Year window for a query; the upper bound drops NIFC's 9999 "unknown year" placeholder rows. */
export function yearWindow(sinceYear: number, now: Date): string {
  return `FIRE_YEAR_INT >= ${sinceYear} AND FIRE_YEAR_INT <= ${now.getUTCFullYear() + 1}`;
}

/** WHERE clause for the nationwide pass: only fires big enough to matter at map scale. */
export function nationalWhere(sinceYear: number, now: Date, minAcres = FIRE_HISTORY_NATIONAL_MIN_ACRES): string {
  return `${yearWindow(sinceYear, now)} AND GIS_ACRES >= ${minAcres}`;
}

/**
 * Nationwide history of large fires (>= FIRE_HISTORY_NATIONAL_MIN_ACRES) so the public map can show
 * "what burned here" anywhere, not just near Watch Locations. Coarser geometry than the per-cell pass;
 * per-cell rows overwrite these where both exist.
 */
async function fetchNational(base: string, sinceYear: number, now: Date): Promise<{ rows: EventInsert[]; pages: number }> {
  const rows: EventInsert[] = [];
  let offset = 0;
  let pages = 0;
  for (; pages < NATIONAL_MAX_PAGES; pages++) {
    const url = new URL(base);
    url.searchParams.set('where', nationalWhere(sinceYear, now));
    url.searchParams.set('outFields', 'OBJECTID,INCIDENT,FIRE_YEAR_INT,GIS_ACRES,UNQE_FIRE_ID');
    url.searchParams.set('orderByFields', 'GIS_ACRES DESC');
    url.searchParams.set('resultRecordCount', String(NATIONAL_PAGE));
    url.searchParams.set('resultOffset', String(offset));
    url.searchParams.set('f', 'geojson');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('geometryPrecision', '3');
    url.searchParams.set('maxAllowableOffset', '0.004');
    const data = await fetchJson<{ features?: HistoryFeature[]; properties?: { exceededTransferLimit?: boolean }; error?: { message: string } }>(url.toString(), { timeoutMs: 120_000 });
    if (data.error) throw new Error(`NIFC history error: ${data.error.message}`);
    const batch = data.features ?? [];
    for (const f of batch) {
      const row = normalizeHistory(f, now);
      if (row) rows.push(row);
    }
    if (!data.properties?.exceededTransferLimit || batch.length === 0) {
      pages += 1;
      break;
    }
    offset += NATIONAL_PAGE;
  }
  return { rows, pages };
}

export const nifcHistoryPoller: Poller = {
  name: 'nifc_history',
  layers: [],
  intervalMinutes: (c) => c.POLL_NIFC_HISTORY_MINUTES,
  disabledReason: () => null,
  async run({ sb, config, now }: PollerContext) {
    const locations = await getWatchLocations(sb);
    const cells = cellsFor(locations, 'history', 'wildfire').slice(0, config.MAX_CELLS_PER_RUN);
    const sinceYear = now.getUTCFullYear() - FIRE_HISTORY_MAX_YEARS;
    const base = config.NIFC_HISTORY_URL || DEFAULT_HISTORY_URL;
    const rows = new Map<string, EventInsert>();
    let national = 0;
    let nationalPages = 0;
    let nationalFailed = false;
    try {
      const result = await fetchNational(base, sinceYear, now);
      for (const row of result.rows) rows.set(row.external_id, row);
      national = result.rows.length;
      nationalPages = result.pages;
    } catch (error) {
      nationalFailed = true;
      log.warn('nifc national history failed', errorFields(error));
    }
    let failedCells = 0;
    for (const cell of cells) {
      try {
        for (const row of await fetchCell(base, cell, sinceYear, now)) rows.set(row.external_id, row);
      } catch (error) {
        failedCells += 1;
        log.warn('nifc history cell failed', { cell: cell.key, ...errorFields(error) });
      }
    }
    if (nationalFailed && (cells.length === 0 || failedCells === cells.length)) throw new Error('NIFC history: national pass and every cell failed');
    const written = await upsertEvents(sb, Array.from(rows.values()));
    return { rows: written, details: { cells: cells.length, failedCells, sinceYear, national, nationalPages, nationalFailed } };
  },
};
