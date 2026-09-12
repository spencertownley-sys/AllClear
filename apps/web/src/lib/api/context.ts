import { LIMITS, enforceRateLimit } from './rate-limit';
import { requireUser, type AuthContext } from './auth';

export interface AuthedContext extends AuthContext {
  /** Rate-limit headers to attach to the response. */
  headers: Record<string, string>;
}

/** Auth + per-user rate limit (API Design §9) for every protected route. */
export async function authed(): Promise<AuthedContext> {
  const ctx = await requireUser();
  const headers = enforceRateLimit(`user:${ctx.user.id}`, LIMITS.authenticatedPerMinute);
  return { ...ctx, headers };
}
