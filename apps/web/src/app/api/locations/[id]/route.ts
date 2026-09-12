import { updateLocationSchema } from '@allclear/shared';
import { authed } from '@/lib/api/context';
import { assertUuid, parseJsonBody } from '@/lib/api/parse';
import { json, noContent, withErrorHandling } from '@/lib/api/respond';
import { deleteLocation, getOwnedLocation, toLocationDTO, updateLocation } from '@/lib/data/locations';

type Context = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Context>(async (_request, { params }) => {
  const { supabase, headers } = await authed();
  const { id } = await params;
  const location = await getOwnedLocation(supabase, assertUuid(id));
  return json(toLocationDTO(location), { headers });
});

export const PATCH = withErrorHandling<Context>(async (request, { params }) => {
  const { supabase, headers } = await authed();
  const { id } = await params;
  const input = await parseJsonBody(request, updateLocationSchema);
  const location = await updateLocation(supabase, assertUuid(id), input);
  return json(toLocationDTO(location), { headers });
});

export const DELETE = withErrorHandling<Context>(async (_request, { params }) => {
  const { supabase, headers } = await authed();
  const { id } = await params;
  await deleteLocation(supabase, assertUuid(id));
  return noContent({ headers });
});
