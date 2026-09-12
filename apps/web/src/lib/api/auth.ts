import { ApiError } from '@allclear/shared';
import type { User } from '@supabase/supabase-js';
import { createClient, type ServerSupabaseClient } from '@/lib/supabase/server';

export interface AuthContext {
  supabase: ServerSupabaseClient;
  user: User;
}

/** Resolves the Supabase session for an API route, or throws 401 UNAUTHORIZED. */
export async function requireUser(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new ApiError('UNAUTHORIZED', 'You need to be logged in to do that.');
  }
  return { supabase, user };
}
