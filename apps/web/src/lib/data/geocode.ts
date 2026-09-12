import 'server-only';
import { ApiError, type GeocodeResult } from '@allclear/shared';
import { serverEnv } from '@/lib/env';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

// Nominatim's usage policy asks for ≤ 1 request/second and an identifying User-Agent.
let lastRequestAt = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + 1000 - now);
  lastRequestAt = now + wait;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
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
    headers: { 'User-Agent': `AllClear ${serverEnv.nwsUserAgent}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new ApiError('INTERNAL_ERROR', "Couldn't reach the location service. Please try again.");
  return (await res.json()) as NominatimResult[] | NominatimResult;
}

export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const data = (await nominatim('/search', {
    q: query,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
    countrycodes: 'us',
  })) as NominatimResult[];
  return (Array.isArray(data) ? data : []).map(toResult).filter((r) => Number.isFinite(r.latitude));
}

export async function reversePlace(lat: number, lng: number): Promise<GeocodeResult | null> {
  const data = (await nominatim('/reverse', {
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '10',
  })) as NominatimResult & { error?: string };
  if (!data || data.error || !data.lat) return null;
  return toResult(data);
}
