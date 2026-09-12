import { ApiError, pushSubscriptionSchema } from '@allclear/shared';
import { z } from 'zod';
import { authed } from '@/lib/api/context';
import { parseJsonBody } from '@/lib/api/parse';
import { json, noContent, withErrorHandling } from '@/lib/api/respond';

/** Register (or refresh) this browser's Web Push subscription. */
export const POST = withErrorHandling(async (request) => {
  const { supabase, user, headers } = await authed();
  const input = await parseJsonBody(request, pushSubscriptionSchema);
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      user_agent: input.user_agent ?? request.headers.get('user-agent')?.slice(0, 512) ?? null,
      failure_count: 0,
    },
    { onConflict: 'endpoint' },
  );
  if (error) {
    console.error('[push] subscribe failed', error);
    throw new ApiError('INTERNAL_ERROR', 'Could not save your push subscription');
  }
  return json({ ok: true }, { status: 201, headers });
});

export const DELETE = withErrorHandling(async (request) => {
  const { supabase, user, headers } = await authed();
  const { endpoint } = await parseJsonBody(request, z.object({ endpoint: z.url() }));
  const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
  if (error) throw new ApiError('INTERNAL_ERROR', 'Could not remove your push subscription');
  return noContent({ headers });
});
