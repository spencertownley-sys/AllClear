import { geocodeSearchSchema, reverseGeocodeSchema } from '@allclear/shared';
import { parseSearchParams } from '@/lib/api/parse';
import { LIMITS, clientIp, enforceRateLimit } from '@/lib/api/rate-limit';
import { json, withErrorHandling } from '@/lib/api/respond';
import { reversePlace, searchPlaces } from '@/lib/data/geocode';

/**
 * Location search / reverse geocoding via OpenStreetMap Nominatim, proxied server-side so the
 * required User-Agent and the 1 req/s policy are enforced in one place. Available to logged-out
 * users because the public Map screen has a search bar.
 */
export const GET = withErrorHandling(async (request) => {
  const headers = enforceRateLimit(`ip:${clientIp(request)}:geocode`, LIMITS.geocodePerMinute);
  const url = new URL(request.url);
  if (url.searchParams.has('lat') && url.searchParams.has('lng')) {
    const { lat, lng } = parseSearchParams(request, reverseGeocodeSchema);
    const result = await reversePlace(lat, lng);
    return json({ data: result }, { headers });
  }
  const { q } = parseSearchParams(request, geocodeSearchSchema);
  const results = await searchPlaces(q);
  return json({ data: results }, { headers });
});
