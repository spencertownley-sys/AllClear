import { SOURCE_STALE_AFTER_MS, type HazardSource } from './constants';

export function isStale(source: HazardSource, fetchedAt: string | null | undefined, now = Date.now()): boolean {
  if (!fetchedAt) return true;
  const ts = Date.parse(fetchedAt);
  if (Number.isNaN(ts)) return true;
  return now - ts > SOURCE_STALE_AFTER_MS[source];
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'unknown';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'unknown';
  const diff = Math.round((now - ts) / 1000);
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? 'ago' : 'from now';
  if (abs < 60) return `${abs}s ${suffix}`;
  if (abs < 3600) return `${Math.round(abs / 60)}m ${suffix}`;
  if (abs < 86400) return `${Math.round(abs / 3600)}h ${suffix}`;
  return `${Math.round(abs / 86400)}d ${suffix}`;
}

export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

export function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371);
}
