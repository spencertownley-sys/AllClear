import { ApiError } from '@allclear/shared';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window, in-memory rate limiter (API Design §9).
 * Each serverless instance keeps its own counters, which is acceptable at MVP scale; swap the
 * store for Upstash/Redis if the public map endpoint starts seeing abuse across many instances.
 */
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, limit, remaining: limit - 1, resetAt: now + windowMs };
  }
  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  return { allowed: existing.count <= limit, limit, remaining, resetAt: existing.resetAt };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export const LIMITS = {
  authenticatedPerMinute: 100,
  publicMapPerMinute: 60,
  geocodePerMinute: 30,
} as const;

/** Enforce a limit and return the headers to attach to the response. Throws 429 when exceeded. */
export function enforceRateLimit(key: string, limit: number, windowMs = 60_000): Record<string, string> {
  const result = checkRateLimit(key, limit, windowMs);
  const headers = rateLimitHeaders(result);
  if (!result.allowed) {
    const error = new ApiError('RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.');
    throw Object.assign(error, { headers });
  }
  return headers;
}

/** Test-only helper. */
export function _resetRateLimits() {
  buckets.clear();
}
