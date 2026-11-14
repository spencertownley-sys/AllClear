import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LruCache, QueueFullError, createIntervalGate, normalizeQuery } from './geocode-cache';

describe('LruCache', () => {
  it('returns cached values until they expire', () => {
    const cache = new LruCache<number>(10, 1_000);
    cache.set('a', 1, 0);
    expect(cache.get('a', 999)).toBe(1);
    expect(cache.get('a', 1_000)).toBeUndefined();
  });

  it('evicts the least recently used entry when full', () => {
    const cache = new LruCache<number>(2, 60_000);
    cache.set('a', 1, 0);
    cache.set('b', 2, 0);
    cache.get('a', 1); // a is now the most recent
    cache.set('c', 3, 2);
    expect(cache.get('b', 3)).toBeUndefined();
    expect(cache.get('a', 3)).toBe(1);
    expect(cache.get('c', 3)).toBe(3);
    expect(cache.size).toBe(2);
  });
});

describe('normalizeQuery', () => {
  it('ignores case and extra whitespace', () => {
    expect(normalizeQuery('  Bend,   OR ')).toBe('bend, or');
  });
});

describe('createIntervalGate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('rejects the overflow instead of queueing forever', async () => {
    const gate = createIntervalGate(1_000, 5);
    const outcomes = Array.from({ length: 10 }, () =>
      gate.acquire().then(
        () => 'ok',
        (error: unknown) => (error instanceof QueueFullError ? 'full' : 'other'),
      ),
    );
    await vi.runAllTimersAsync();
    const results = await Promise.all(outcomes);
    // One goes straight through, five wait their turn, the other four are turned away.
    expect(results.filter((r) => r === 'ok')).toHaveLength(6);
    expect(results.filter((r) => r === 'full')).toHaveLength(4);
    expect(gate.waiting).toBe(0);
  });

  it('spaces callers at least one interval apart', async () => {
    const gate = createIntervalGate(1_000, 5);
    const times: number[] = [];
    const start = Date.now();
    const runs = [gate.acquire(), gate.acquire(), gate.acquire()].map((p) => p.then(() => times.push(Date.now() - start)));
    await vi.runAllTimersAsync();
    await Promise.all(runs);
    expect(times).toEqual([0, 1_000, 2_000]);
  });
});
