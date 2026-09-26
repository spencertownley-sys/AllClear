import { authed } from '@/lib/api/context';
import { assertUuid } from '@/lib/api/parse';
import { noContent, withErrorHandling } from '@/lib/api/respond';
import { getOwnedLocation } from '@/lib/data/locations';
import { deleteCheckin } from '@/lib/data/safety';

type Context = { params: Promise<{ id: string; checkinId: string }> };

/** Undo a safety check-in (e.g. marked safe by mistake). */
export const DELETE = withErrorHandling<Context>(async (_request, { params }) => {
  const { supabase, headers } = await authed();
  const { id, checkinId } = await params;
  const location = await getOwnedLocation(supabase, assertUuid(id));
  await deleteCheckin(supabase, location.id, assertUuid(checkinId, 'checkinId'));
  return noContent({ headers });
});
