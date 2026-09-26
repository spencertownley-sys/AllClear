import { CELL_SIZE_DEG, cellKey, type WeatherOutlook, type WeatherOutlookPeriod } from '@allclear/shared';
import { fetchJson } from '../http';
import { cellsFor, type Cell } from '../cells';
import { getWatchLocations, upsertWeather, type WeatherInsert } from '../db';
import { log, errorFields } from '../logger';
import type { Poller, PollerContext } from './types';

/**
 * NOAA Climate Prediction Center 6–10 and 8–14 day outlooks (public ArcGIS map services):
 * probability that temperature / precipitation runs above or below normal. Polygons are
 * regional, so one point lookup per ~1° cell serves every weather cell inside it.
 */
const BASE = 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks';
const LAYERS: Array<{ key: WeatherOutlookPeriod['key']; label: string; service: string; temperature: number; precipitation: number }> = [
  { key: '6-10', label: 'Days 6–10', service: 'cpc_6_10_day_outlk', temperature: 0, precipitation: 1 },
  { key: '8-14', label: 'Days 8–14', service: 'cpc_8_14_day_outlk', temperature: 0, precipitation: 1 },
];

export interface CpcAttributes {
  fcst_date?: number | null;
  start_date?: number | null;
  end_date?: number | null;
  prob?: number | null;
  cat?: string | null;
}

const isoDate = (ms: number | null | undefined): string | null => (typeof ms === 'number' ? new Date(ms).toISOString().slice(0, 10) : null);

/** Fold the four layer hits (temp + precip for each window) into one outlook. */
export function buildOutlook(hits: Record<string, CpcAttributes | null>): WeatherOutlook | null {
  const periods: WeatherOutlookPeriod[] = [];
  let issued: string | null = null;
  for (const layer of LAYERS) {
    const t = hits[`${layer.key}:temperature`] ?? null;
    const p = hits[`${layer.key}:precipitation`] ?? null;
    const any = t ?? p;
    if (!any) continue;
    const start = isoDate(any.start_date);
    const end = isoDate(any.end_date);
    if (!start || !end) continue;
    issued = issued ?? (typeof any.fcst_date === 'number' ? new Date(any.fcst_date).toISOString() : null);
    const pick = (a: CpcAttributes | null) => (a?.cat ? { category: a.cat, probability: typeof a.prob === 'number' ? a.prob : null } : null);
    periods.push({ key: layer.key, label: layer.label, start_date: start, end_date: end, temperature: pick(t), precipitation: pick(p) });
  }
  return periods.length ? { periods, issued_at: issued } : null;
}

async function lookup(point: Cell): Promise<WeatherOutlook | null> {
  const hits: Record<string, CpcAttributes | null> = {};
  for (const layer of LAYERS) {
    for (const kind of ['temperature', 'precipitation'] as const) {
      const url = new URL(`${BASE}/${layer.service}/MapServer/${layer[kind]}/query`);
      url.searchParams.set('geometry', `${point.longitude.toFixed(4)},${point.latitude.toFixed(4)}`);
      url.searchParams.set('geometryType', 'esriGeometryPoint');
      url.searchParams.set('inSR', '4326');
      url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
      url.searchParams.set('outFields', 'fcst_date,start_date,end_date,prob,cat');
      url.searchParams.set('returnGeometry', 'false');
      url.searchParams.set('f', 'json');
      const data = await fetchJson<{ features?: Array<{ attributes: CpcAttributes }>; error?: { message: string } }>(url.toString(), { timeoutMs: 45_000 });
      if (data.error) throw new Error(`CPC error: ${data.error.message}`);
      // Several polygons can overlap at a boundary; keep the most confident one.
      const best = (data.features ?? []).map((f) => f.attributes).sort((a, b) => (b.prob ?? 0) - (a.prob ?? 0))[0] ?? null;
      hits[`${layer.key}:${kind}`] = best;
    }
  }
  return buildOutlook(hits);
}

export const cpcOutlookPoller: Poller = {
  name: 'cpc_outlook',
  layers: ['weather'],
  intervalMinutes: (c) => c.POLL_CPC_MINUTES,
  disabledReason: () => null,
  async run({ sb, config, now }: PollerContext) {
    const locations = await getWatchLocations(sb);
    const weatherCells = cellsFor(locations, 'weather', 'weather').slice(0, config.MAX_CELLS_PER_RUN);
    // Group weather cells by coarse outlook cell so each CPC lookup is shared.
    const groups = new Map<string, { point: Cell; members: Cell[] }>();
    for (const cell of weatherCells) {
      const key = cellKey(cell, CELL_SIZE_DEG.outlook);
      const group = groups.get(key) ?? { point: cell, members: [] };
      group.members.push(cell);
      groups.set(key, group);
    }
    const rows: WeatherInsert[] = [];
    let failed = 0;
    let empty = 0;
    for (const group of groups.values()) {
      try {
        const outlook = await lookup(group.point);
        if (!outlook) empty += 1;
        for (const cell of group.members) {
          rows.push({
            grid_key: cell.key,
            latitude: cell.latitude,
            longitude: cell.longitude,
            outlook,
            outlook_fetched_at: now.toISOString(),
          });
        }
      } catch (error) {
        failed += 1;
        log.warn('cpc outlook lookup failed', { cell: group.point.key, ...errorFields(error) });
      }
    }
    if (groups.size > 0 && failed === groups.size) throw new Error('Every CPC outlook lookup failed');
    const written = await upsertWeather(sb, rows);
    return { rows: written, details: { weatherCells: weatherCells.length, lookups: groups.size, failed, empty } };
  },
};
