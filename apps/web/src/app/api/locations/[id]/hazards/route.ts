import { locationHazardsQuerySchema } from '@allclear/shared';
import { authed } from '@/lib/api/context';
import { assertUuid, parseSearchParams } from '@/lib/api/parse';
import { json, withErrorHandling } from '@/lib/api/respond';
import { getLocationHazards } from '@/lib/data/hazards';
import { getLayers } from '@/lib/data/layers';
import { getOwnedLocation } from '@/lib/data/locations';

type Context = { params: Promise<{ id: string }> };

/** The core aggregation endpoint — reads only from the caches, never an external API. */
export const GET = withErrorHandling<Context>(async (request, { params }) => {
  const { supabase, headers } = await authed();
  const { id } = await params;
  const { history_years } = parseSearchParams(request, locationHazardsQuerySchema);
  const location = await getOwnedLocation(supabase, assertUuid(id));
  const layers = await getLayers(supabase, location.id);
  const hazards = await getLocationHazards(supabase, location, layers, { historyYears: history_years });
  return json(hazards, { headers: { ...headers, 'Cache-Control': 'private, max-age=30' } });
});
