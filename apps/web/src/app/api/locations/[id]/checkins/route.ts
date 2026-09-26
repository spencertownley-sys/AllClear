import { createCheckinSchema } from '@allclear/shared';
import { authed } from '@/lib/api/context';
import { assertUuid, parseJsonBody } from '@/lib/api/parse';
import { json, withErrorHandling } from '@/lib/api/respond';
import { getOwnedLocation } from '@/lib/data/locations';
import { createCheckin, listCheckins } from '@/lib/data/safety';

type Context = { params: Promise<{ id: string }> };

/** Personal "I'm safe" markers for one Watch Location — private to the account, never shared. */
export const GET = withErrorHandling<Context>(async (_request, { params }) => {
  const { supabase, headers } = await authed();
  const { id } = await params;
  const location = await getOwnedLocation(supabase, assertUuid(id));
  return json({ data: await listCheckins(supabase, location.id) }, { headers });
});

export const POST = withErrorHandling<Context>(async (request, { params }) => {
  const { supabase, user, headers } = await authed();
  const { id } = await params;
  const location = await getOwnedLocation(supabase, assertUuid(id));
  const input = await parseJsonBody(request, createCheckinSchema);
  const checkin = await createCheckin(supabase, user.id, location.id, input);
  return json(checkin, { status: 201, headers });
});
