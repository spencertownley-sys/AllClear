import { layersPutSchema } from '@allclear/shared';
import { authed } from '@/lib/api/context';
import { assertUuid, parseJsonBody } from '@/lib/api/parse';
import { json, withErrorHandling } from '@/lib/api/respond';
import { getLayers, putLayers } from '@/lib/data/layers';
import { getOwnedLocation } from '@/lib/data/locations';

type Context = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Context>(async (_request, { params }) => {
  const { supabase, headers } = await authed();
  const { id } = await params;
  const location = await getOwnedLocation(supabase, assertUuid(id));
  return json({ data: await getLayers(supabase, location.id) }, { headers });
});

export const PUT = withErrorHandling<Context>(async (request, { params }) => {
  const { supabase, headers } = await authed();
  const { id } = await params;
  const location = await getOwnedLocation(supabase, assertUuid(id));
  const input = await parseJsonBody(request, layersPutSchema);
  return json({ data: await putLayers(supabase, location.id, input) }, { headers });
});
