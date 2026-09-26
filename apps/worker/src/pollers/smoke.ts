import type { Json, SmokeDensity } from '@allclear/shared';
import { fetchJson } from '../http';
import { bboxCenter, geojsonToEwkt, vertexCount } from '../geojson';
import { upsertEvents, type EventInsert } from '../db';
import type { Poller, PollerContext } from './types';

/**
 * NOAA/NESDIS Hazard Mapping System (HMS) satellite smoke analysis — a public, key-less ArcGIS
 * Feature Service. Free for any use (CC0): https://www.ospo.noaa.gov/products/land/hms.html
 */
export const DEFAULT_SMOKE_URL =
  "https://services2.arcgis.com/C8EMgrsFcRFL6LrL/arcgis/rest/services/NOAA_Satellite_Smoke_Detection_(v1)/FeatureServer/0/query";
const PAGE = 1000;
const TTL_HOURS = 8;
const MAX_VERTICES = 20_000;

export interface SmokeFeature {
  geometry: { type: string; coordinates: unknown } | null;
  properties: {
    FID?: number | null;
    Satellite?: string | null;
    Start?: string | null;
    End_?: string | null;
    Density?: string | null;
  };
}

/** HMS timestamps are "YYYYDDD HHMM" in UTC (4-digit year, 3-digit day-of-year, space, HHMM). */
export function parseHmsTimestamp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = /^(\d{4})(\d{3})\s+(\d{2})(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const [, year, dayOfYear, hh, mm] = m;
  const d = new Date(Date.UTC(Number(year), 0, 1));
  d.setUTCDate(d.getUTCDate() + Number(dayOfYear) - 1);
  d.setUTCHours(Number(hh), Number(mm), 0, 0);
  return d.toISOString();
}

export function normalizeDensity(raw: string | null | undefined): SmokeDensity {
  const v = (raw ?? '').trim().toLowerCase();
  return v === 'medium' || v === 'heavy' ? v : 'light';
}

const DENSITY_TITLE: Record<SmokeDensity, string> = { light: 'Light smoke', medium: 'Medium smoke', heavy: 'Heavy smoke' };

export function normalizeSmoke(feature: SmokeFeature, now: Date): EventInsert | null {
  const p = feature.properties;
  if (!feature.geometry || p.FID === null || p.FID === undefined) return null;
  if (vertexCount(feature.geometry) > MAX_VERTICES) return null;
  const geometry = geojsonToEwkt(feature.geometry);
  const center = bboxCenter(feature.geometry);
  if (!geometry || !center) return null;
  const density = normalizeDensity(p.Density);
  const startAt = parseHmsTimestamp(p.Start);
  const endAt = parseHmsTimestamp(p.End_);
  return {
    source: 'nesdis',
    external_id: `hms-smoke:${p.FID}`,
    event_type: 'smoke_plume',
    title: DENSITY_TITLE[density],
    severity: null,
    latitude: center.latitude,
    longitude: center.longitude,
    geometry,
    occurred_at: startAt,
    attributes: {
      density,
      satellite: p.Satellite ?? null,
      start_at: startAt,
      end_at: endAt,
      provider: 'noaa-nesdis-hms',
    },
    raw_payload: p as unknown as Json,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + TTL_HOURS * 3_600_000).toISOString(),
  };
}

export const smokePoller: Poller = {
  name: 'smoke',
  layers: ['wildfire'],
  intervalMinutes: (c) => c.POLL_SMOKE_MINUTES,
  disabledReason: () => null,
  async run({ sb, config, now }: PollerContext) {
    const base = config.SMOKE_URL || DEFAULT_SMOKE_URL;
    const rows: EventInsert[] = [];
    let skipped = 0;
    let offset = 0;
    for (let page = 0; page < 10; page++) {
      const url = new URL(base);
      url.searchParams.set('where', '1=1');
      url.searchParams.set('outFields', 'FID,Satellite,Start,End_,Density');
      url.searchParams.set('f', 'geojson');
      url.searchParams.set('outSR', '4326');
      url.searchParams.set('geometryPrecision', '4');
      url.searchParams.set('maxAllowableOffset', '0.01');
      url.searchParams.set('resultRecordCount', String(PAGE));
      url.searchParams.set('resultOffset', String(offset));
      const data = await fetchJson<{ features?: SmokeFeature[]; properties?: { exceededTransferLimit?: boolean }; error?: { message: string } }>(
        url.toString(),
        { timeoutMs: 60_000 },
      );
      if (data.error) throw new Error(`NOAA/NESDIS smoke error: ${data.error.message}`);
      for (const f of data.features ?? []) {
        const row = normalizeSmoke(f, now);
        if (row) rows.push(row);
        else skipped += 1;
      }
      if (!data.properties?.exceededTransferLimit || (data.features ?? []).length === 0) break;
      offset += PAGE;
    }
    const written = await upsertEvents(sb, rows);
    return { rows: written, details: { skipped } };
  },
};
