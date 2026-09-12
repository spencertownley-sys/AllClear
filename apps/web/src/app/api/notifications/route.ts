import { paginationSchema } from '@allclear/shared';
import { authed } from '@/lib/api/context';
import { parseSearchParams } from '@/lib/api/parse';
import { json, withErrorHandling } from '@/lib/api/respond';
import { listNotifications } from '@/lib/data/notifications';

export const GET = withErrorHandling(async (request) => {
  const { supabase, headers } = await authed();
  const { page, limit } = parseSearchParams(request, paginationSchema);
  const result = await listNotifications(supabase, page, limit);
  return json({ data: result.data, meta: { page: result.meta.page, total: result.meta.total } }, { headers });
});
