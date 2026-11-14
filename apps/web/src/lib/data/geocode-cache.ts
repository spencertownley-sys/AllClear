/**
 * Small helpers for the Nominatim proxy (NW-07), kept free of server-only imports so they can be
 * unit tested: an LRU cache with a TTL, and a one-request-per-interval gate with a bounded queue.
 */

export class LruCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string, now = Date.now()): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    // Re-insert so Map order tracks recency: the first key is always the least recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, now = Date.now()): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

/** Thrown by the gate when too many callers are already waiting for a slot. */
export class QueueFullError extends Error {
  constructor() {
    super('Too many requests are already waiting');
    this.name = 'QueueFullError';
  }
}

/**
 * Lets one caller through every `intervalMs`. Callers that would have to wait join a queue of at
 * most `maxWaiting`; beyond that the gate rejects at once instead of letting requests pile up.
 */
export function createIntervalGate(intervalMs: number, maxWaiting: number) {
  let nextSlotAt = 0;
  let waiting = 0;
  return {
    async acquire(): Promise<void> {
      const now = Date.now();
      const wait = Math.max(0, nextSlotAt - now);
      if (wait > 0 && waiting >= maxWaiting) throw new QueueFullError();
      nextSlotAt = now + wait + intervalMs;
      if (wait === 0) return;
      waiting += 1;
      try {
        await new Promise((resolve) => setTimeout(resolve, wait));
      } finally {
        waiting -= 1;
      }
    },
    get waiting() {
      return waiting;
    },
  };
}

/** Cache key for a search: case, surrounding space and repeated spaces don't change the answer. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}
