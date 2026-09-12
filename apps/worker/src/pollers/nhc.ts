import type { Json } from '@allclear/shared';
import { fetchJson } from '../http';
import { upsertEvents, type EventInsert } from '../db';
import type { Poller, PollerContext } from './types';

const NHC_URL = 'https://www.nhc.noaa.gov/CurrentStorms.json';
const TTL_HOURS = 12;

export interface NhcStorm {
  id: string;
  binNumber?: string;
  name: string;
  classification: string;
  intensity?: string | number;
  pressure?: string | number;
  latitudeNumeric: number;
  longitudeNumeric: number;
  movementDir?: number;
  movementSpeed?: number;
  lastUpdate?: string;
  publicAdvisory?: { url?: string; advNum?: string };
}

const CLASS_LABEL: Record<string, string> = {
  TD: 'Tropical Depression',
  TS: 'Tropical Storm',
  HU: 'Hurricane',
  MH: 'Major Hurricane',
  STD: 'Subtropical Depression',
  STS: 'Subtropical Storm',
  PTC: 'Potential Tropical Cyclone',
  PC: 'Post-Tropical Cyclone',
  TC: 'Tropical Cyclone',
  RL: 'Remnant Low',
};

export function classificationLabel(code: string): string {
  return CLASS_LABEL[code] ?? code;
}

export function normalizeStorm(storm: NhcStorm, now: Date): EventInsert | null {
  if (!storm.id || !Number.isFinite(storm.latitudeNumeric) || !Number.isFinite(storm.longitudeNumeric)) return null;
  const intensityKt = Number(storm.intensity);
  const pressure = Number(storm.pressure);
  return {
    source: 'nhc',
    external_id: `nhc:${storm.id}`,
    event_type: 'tropical_cyclone',
    title: `${classificationLabel(storm.classification)} ${storm.name}`,
    severity: storm.classification,
    latitude: storm.latitudeNumeric,
    longitude: storm.longitudeNumeric,
    occurred_at: storm.lastUpdate ?? null,
    attributes: {
      name: storm.name,
      classification: storm.classification,
      intensity_kt: Number.isFinite(intensityKt) ? intensityKt : null,
      max_wind_mph: Number.isFinite(intensityKt) ? Math.round(intensityKt * 1.15078) : null,
      pressure_mb: Number.isFinite(pressure) ? pressure : null,
      movement_dir: typeof storm.movementDir === 'number' ? storm.movementDir : null,
      movement_mph: typeof storm.movementSpeed === 'number' ? storm.movementSpeed : null,
      url: storm.publicAdvisory?.url ?? `https://www.nhc.noaa.gov/`,
      bin: storm.binNumber ?? null,
    },
    raw_payload: storm as unknown as Json,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + TTL_HOURS * 3_600_000).toISOString(),
  };
}

export const nhcPoller: Poller = {
  name: 'nhc',
  layers: [],
  intervalMinutes: (c) => c.POLL_NHC_MINUTES,
  disabledReason: () => null,
  async run({ sb, now }: PollerContext) {
    const data = await fetchJson<{ activeStorms?: NhcStorm[] }>(NHC_URL);
    const rows = (data.activeStorms ?? []).map((s) => normalizeStorm(s, now)).filter((r): r is EventInsert => r !== null);
    const active = new Set(rows.map((r) => r.external_id));
    // Storms that dropped off the active list are over: expire them now rather than waiting out the TTL.
    const { data: existing } = await sb
      .from('cached_hazard_events')
      .select('id, external_id')
      .eq('source', 'nhc')
      .or('expires_at.is.null,expires_at.gt.now()');
    const gone = (existing ?? []).filter((r) => !active.has(r.external_id)).map((r) => r.id);
    if (gone.length > 0) await sb.from('cached_hazard_events').update({ expires_at: now.toISOString() }).in('id', gone);
    const written = await upsertEvents(sb, rows);
    return { rows: written, details: { active: rows.length, expired: gone.length } };
  },
};
