import 'server-only';
import { ApiError, type GeocodeResult } from '@nimbuswatch/shared';
import { serverEnv } from '@/lib/env';
import { LruCache, QueueFullError, createIntervalGate, normalizeQuery } from './geocode-cache';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

// Nominatim's usage policy asks for ≤ 1 request/second, an identifying User-Agent and caching of
// results. Repeated lookups come from memory; at most 5 requests wait for a slot and the rest are
// turned away with RATE_LIMITED instead of stalling search for everyone.
const gate = createIntervalGate(1000, 5);
const searchCache = new LruCache<GeocodeResult[]>(500, 24 * 3_600_000);
const reverseCache = new LruCache<GeocodeResult | null>(500, 24 * 3_600_000);

async function throttle() {
  try {
    await gate.acquire();
  } catch (error) {
    if (error instanceof QueueFullError) {
      throw new ApiError('RATE_LIMITED', 'Location search is busy right now. Please try again in a few seconds.');
    }
    throw error;
  }
}

function toResult(item: NominatimResult): GeocodeResult {
  const a = item.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.county ?? null;
  const state = a['ISO3166-2-lvl4']?.split('-')[1] ?? a.state ?? null;
  return {
    display_name: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    city_name: city,
    state,
    postal_code: a.postcode ? a.postcode.trim().slice(0, 12) : null,
    country: (a.country_code ?? 'us').toUpperCase(),
  };
}

async function nominatim(path: string, params: Record<string, string>): Promise<NominatimResult[] | NominatimResult> {
  await throttle();
  const url = new URL(`${NOMINATIM}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: { 'User-Agent': `NimbusWatch ${serverEnv.nwsUserAgent}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new ApiError('INTERNAL_ERROR', "Couldn't reach the location service. Please try again.");
  return (await res.json()) as NominatimResult[] | NominatimResult;
}

export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const key = normalizeQuery(query);
  const cached = searchCache.get(key);
  if (cached) return cached;
  const data = (await nominatim('/search', {
    q: query,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
    countrycodes: 'us',
  })) as NominatimResult[];
  const results = (Array.isArray(data) ? data : []).map(toResult).filter((r) => Number.isFinite(r.latitude));
  searchCache.set(key, results);
  return results;
}

export async function reversePlace(lat: number, lng: number): Promise<GeocodeResult | null> {
  // ~100 m grid: a reverse lookup at zoom 10 (city level) gives the same answer within it.
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = reverseCache.get(key);
  if (cached !== undefined) return cached;
  const data = (await nominatim('/reverse', {
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '10',
  })) as NominatimResult & { error?: string };
  const result = !data || data.error || !data.lat ? null : toResult(data);
  reverseCache.set(key, result);
  return result;
}
