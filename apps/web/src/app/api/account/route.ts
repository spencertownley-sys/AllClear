import { ApiError } from '@allclear/shared';
import { authed } from '@/lib/api/context';
import { noContent, withErrorHandling } from '@/lib/api/respond';
import { getAdminClient } from '@/lib/supabase/admin';

/** Permanently delete the current account. Watch Locations, rules and history cascade in the DB. */
export const DELETE = withErrorHandling(async () => {
  const { supabase, user, headers } = await authed();
  const admin = getAdminClient();
  if (!admin) {
    throw new ApiError('INTERNAL_ERROR', 'Account deletion is not configured on this deployment yet.');
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('[account] delete failed', error);
    throw new ApiError('INTERNAL_ERROR', 'Could not delete your account. Please try again.');
  }
  await supabase.auth.signOut();
  return noContent({ headers });
});
