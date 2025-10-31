// Simple in-memory cache with TTL. Suitable for single-node or dev.
// For production, back this with Redis/KV and distributed cron warmers.

type CacheEntry<T> = {
  value: T;
  expiresAt: number; // epoch ms
};

class TTLCache<T = unknown> {
  private store: Map<string, CacheEntry<T>> = new Map();

  constructor(private defaultTtlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.store.set(key, { value, expiresAt });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const globalCache = global as unknown as { __mgnrega_cache?: TTLCache };

if (!globalCache.__mgnrega_cache) {
  globalCache.__mgnrega_cache = new TTLCache(24 * 60 * 60 * 1000); // 24h default
}

export const cache = globalCache.__mgnrega_cache as TTLCache;


