import { uvCategory, type Json } from '@allclear/shared';
import { fetchJson } from '../http';
import { getWatchLocations, upsertEvents, type EventInsert, type WatchLocationWithLayers } from '../db';
import { log, errorFields } from '../logger';
import type { Poller, PollerContext } from './types';

const TTL_HOURS = 26;

export interface EpaUvRow {
  ZIP_CODE?: string;
  CITY?: string;
  STATE?: string;
  UV_INDEX?: string | number;
  UV_ALERT?: string | number;
  DATE?: string;
}

const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

/** EPA dates look like "Sep/12/2026". */
export function parseEpaDate(value: string | undefined): string | null {
  if (!value) return null;
  const m = /^([A-Za-z]{3})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const month = MONTHS[m[1]!];
  if (!month) return null;
  return `${m[3]}-${month}-${m[2]!.padStart(2, '0')}`;
}

export function normalizeUv(rows: EpaUvRow[], zip: string, at: { latitude: number; longitude: number }, now: Date): EventInsert | null {
  const row = rows.find((r) => Number.isFinite(Number(r.UV_INDEX)));
  if (!row) return null;
  const index = Number(row.UV_INDEX);
  const category = uvCategory(index);
  const date = parseEpaDate(row.DATE);
  return {
    source: 'epa',
    external_id: `epa-uv:${zip}`,
    event_type: 'uv_index',
    title: `UV index ${index} (${category.name})`,
    severity: category.name,
    latitude: at.latitude,
    longitude: at.longitude,
    occurred_at: date ? `${date}T12:00:00.000Z` : null,
    attributes: {
      uv_index: index,
      alert: String(row.UV_ALERT) === '1',
      date,
      zip,
      city: row.CITY ?? null,
      state: row.STATE ?? null,
    },
    raw_payload: row as unknown as Json,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + TTL_HOURS * 3_600_000).toISOString(),
  };
}

function zipOf(location: WatchLocationWithLayers): string | null {
  const zip = (location.postal_code ?? '').trim().slice(0, 5);
  return /^\d{5}$/.test(zip) ? zip : null;
}

export const epaUvPoller: Poller = {
  name: 'epa_uv',
  layers: [],
  intervalMinutes: (c) => c.POLL_EPA_UV_MINUTES,
  disabledReason: () => null,
  async run({ sb, config, now }: PollerContext) {
    const locations = await getWatchLocations(sb);
    const byZip = new Map<string, WatchLocationWithLayers>();
    for (const loc of locations) {
      const weather = loc.location_layers.find((l) => l.layer_type === 'weather');
      if (weather && !weather.enabled) continue;
      const zip = zipOf(loc);
      if (zip && !byZip.has(zip)) byZip.set(zip, loc);
    }
    const zips = Array.from(byZip.entries()).slice(0, config.MAX_CELLS_PER_RUN);
    const rows: EventInsert[] = [];
    let failed = 0;
    for (const [zip, loc] of zips) {
      try {
        const data = await fetchJson<EpaUvRow[]>(`https://data.epa.gov/efservice/getEnvirofactsUVDAILY/ZIP/${zip}/JSON`);
        const row = normalizeUv(Array.isArray(data) ? data : [], zip, { latitude: Number(loc.latitude), longitude: Number(loc.longitude) }, now);
        if (row) rows.push(row);
      } catch (error) {
        failed += 1;
        log.warn('epa uv zip failed', { zip, ...errorFields(error) });
      }
    }
    if (zips.length > 0 && failed === zips.length) throw new Error('Every EPA UV request failed');
    const written = await upsertEvents(sb, rows);
    return { rows: written, details: { zips: zips.length, failed } };
  },
};
