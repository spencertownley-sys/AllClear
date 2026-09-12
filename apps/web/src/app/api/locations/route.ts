import { createLocationSchema } from '@allclear/shared';
import { authed } from '@/lib/api/context';
import { parseJsonBody } from '@/lib/api/parse';
import { json, withErrorHandling } from '@/lib/api/respond';
import { createLocation, listLocations, toLocationDTO } from '@/lib/data/locations';

export const GET = withErrorHandling(async () => {
  const { supabase, headers } = await authed();
  const locations = await listLocations(supabase);
  return json({ data: locations.map(toLocationDTO) }, { headers });
});

export const POST = withErrorHandling(async (request) => {
  const { supabase, user, headers } = await authed();
  const input = await parseJsonBody(request, createLocationSchema);
  const location = await createLocation(supabase, user.id, input);
  return json(toLocationDTO(location), { status: 201, headers });
});
