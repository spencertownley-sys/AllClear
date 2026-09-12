import { authed } from '@/lib/api/context';
import { assertUuid } from '@/lib/api/parse';
import { json, withErrorHandling } from '@/lib/api/respond';
import { getLocationHazards } from '@/lib/data/hazards';
import { getLayers } from '@/lib/data/layers';
import { getOwnedLocation } from '@/lib/data/locations';

type Context = { params: Promise<{ id: string }> };

/** The core aggregation endpoint — reads only from the caches, never an external API. */
export const GET = withErrorHandling<Context>(async (_request, { params }) => {
  const { supabase, headers } = await authed();
  const { id } = await params;
  const location = await getOwnedLocation(supabase, assertUuid(id));
  const layers = await getLayers(supabase, location.id);
  const hazards = await getLocationHazards(supabase, location, layers);
  return json(hazards, { headers: { ...headers, 'Cache-Control': 'private, max-age=30' } });
});
