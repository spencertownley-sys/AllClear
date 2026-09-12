import { beforeEach, describe, expect, it } from 'vitest';
import { _resetRateLimits, checkRateLimit, rateLimitHeaders } from './rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => _resetRateLimits());

  it('allows up to the limit within a window and then blocks', () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit('ip:1', 3, 60_000, now + i).allowed).toBe(true);
    }
    const blocked = checkRateLimit('ip:1', 3, 60_000, now + 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('resets after the window elapses', () => {
    const now = 1_000_000;
    checkRateLimit('ip:2', 1, 1_000, now);
    expect(checkRateLimit('ip:2', 1, 1_000, now + 500).allowed).toBe(false);
    expect(checkRateLimit('ip:2', 1, 1_000, now + 1_001).allowed).toBe(true);
  });

  it('keeps separate counters per key', () => {
    const now = 1_000_000;
    checkRateLimit('a', 1, 60_000, now);
    expect(checkRateLimit('b', 1, 60_000, now).allowed).toBe(true);
  });

  it('produces the documented headers', () => {
    const headers = rateLimitHeaders({ allowed: true, limit: 60, remaining: 59, resetAt: 2_000_000 });
    expect(headers['X-RateLimit-Limit']).toBe('60');
    expect(headers['X-RateLimit-Remaining']).toBe('59');
    expect(headers['X-RateLimit-Reset']).toBe('2000');
  });
});
