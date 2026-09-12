import type { Json } from '@allclear/shared';
import { fetchJson } from '../http';
import type { EventInsert } from '../db';
import { upsertEvents } from '../db';
import type { Poller, PollerContext } from './types';

const FEEDS = [
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
];

const KEEP_DAYS = 7;

export interface UsgsFeature {
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number, number?] } | null;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    updated?: number;
    url?: string;
    title?: string;
    tsunami?: number;
    felt?: number | null;
    alert?: string | null;
    status?: string;
    type?: string;
  };
}

export function normalizeUsgs(feature: UsgsFeature, now: Date): EventInsert | null {
  if (!feature.geometry || feature.properties.mag === null) return null;
  if (feature.properties.type && feature.properties.type !== 'earthquake') return null;
  const [lng, lat, depth] = feature.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const occurred = new Date(feature.properties.time);
  return {
    source: 'usgs',
    external_id: feature.id,
    event_type: 'earthquake',
    title: feature.properties.title ?? `M ${feature.properties.mag} - ${feature.properties.place ?? 'unknown location'}`,
    description: null,
    severity: feature.properties.alert ?? null,
    latitude: lat,
    longitude: lng,
    magnitude: feature.properties.mag,
    occurred_at: occurred.toISOString(),
    attributes: {
      place: feature.properties.place,
      url: feature.properties.url ?? null,
      depth_km: depth ?? null,
      tsunami: feature.properties.tsunami ?? 0,
      felt: feature.properties.felt ?? null,
      status: feature.properties.status ?? null,
    },
    raw_payload: feature.properties as unknown as Json,
    fetched_at: now.toISOString(),
    expires_at: new Date(occurred.getTime() + KEEP_DAYS * 86_400_000).toISOString(),
  };
}

export const usgsPoller: Poller = {
  name: 'usgs',
  layers: ['earthquake'],
  intervalMinutes: (c) => c.POLL_USGS_MINUTES,
  disabledReason: () => null,
  async run({ sb, now }: PollerContext) {
    const rows = new Map<string, EventInsert>();
    for (const url of FEEDS) {
      const feed = await fetchJson<{ features: UsgsFeature[] }>(url);
      for (const feature of feed.features ?? []) {
        const row = normalizeUsgs(feature, now);
        if (row) rows.set(row.external_id, row);
      }
    }
    const written = await upsertEvents(sb, Array.from(rows.values()));
    return { rows: written, details: { feeds: FEEDS.length } };
  },
};
