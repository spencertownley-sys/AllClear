import { mapQuerySchema } from '@allclear/shared';
import { parseSearchParams } from '@/lib/api/parse';
import { LIMITS, clientIp, enforceRateLimit } from '@/lib/api/rate-limit';
import { json, withErrorHandling } from '@/lib/api/respond';
import { getMapData } from '@/lib/data/map';
import { createClient } from '@/lib/supabase/server';

/**
 * Public, unauthenticated national map data (API Design §5). This is the one surface reachable
 * without a session, so it gets its own tighter, per-IP rate limit.
 */
export const GET = withErrorHandling(async (request) => {
  const headers = enforceRateLimit(`ip:${clientIp(request)}:map`, LIMITS.publicMapPerMinute);
  const { bbox, layers } = parseSearchParams(request, mapQuerySchema);
  const supabase = await createClient();
  const data = await getMapData(supabase, bbox, layers);
  return json(data, { headers: { ...headers, 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } });
});
