// Redis-backed cache with TTL. Supports Upstash REST API, TCP Redis, and in-memory fallback.
import { getRedisClient } from "./redis"
import { getUpstashRedisClient } from "./redis-upstash"

type CacheEntry<T> = {
  value: T
  expiresAt: number // epoch ms
}

// In-memory fallback cache
class InMemoryCache {
  private store: Map<string, CacheEntry<unknown>> = new Map()

  constructor(private defaultTtlMs: number) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value as T
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs)
    this.store.set(key, { value, expiresAt })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

// Unified Redis cache implementation (supports Upstash REST API and TCP Redis)
class RedisCache {
  private fallback: InMemoryCache
  private upstashClient: ReturnType<typeof getUpstashRedisClient> | null
  private redisClient: ReturnType<typeof getRedisClient> | null
  private defaultTtlSeconds: number
  private cacheType: "upstash" | "redis" | "memory" = "memory"

  constructor(defaultTtlMs: number) {
    this.defaultTtlSeconds = Math.floor(defaultTtlMs / 1000)
    this.fallback = new InMemoryCache(defaultTtlMs)
    this.upstashClient = null
    this.redisClient = null
    
    // Try Upstash REST API first (best for serverless)
    this.upstashClient = getUpstashRedisClient()
    if (this.upstashClient) {
      this.cacheType = "upstash"
      console.log("[Cache] Using Upstash Redis (REST API)")
      return
    }

    // Fallback to TCP Redis (ioredis)
    this.redisClient = getRedisClient()
    if (this.redisClient) {
      this.cacheType = "redis"
      console.log("[Cache] Using Redis (TCP)")
      return
    }

    // Final fallback to in-memory
    this.cacheType = "memory"
    console.log("[Cache] Using in-memory cache (Redis not configured)")
  }

  async get<T>(key: string): Promise<T | undefined> {
    // Try Upstash REST API first
    if (this.upstashClient) {
      try {
        const data = await this.upstashClient.get<string>(key)
        if (data && typeof data === 'string') {
          const parsed = JSON.parse(data) as CacheEntry<T>
          // Check if expired
          if (Date.now() > parsed.expiresAt) {
            await this.del(key)
            return undefined
          }
          return parsed.value
        }
      } catch (error) {
        console.warn(`[Upstash Cache] Get error for key "${key}":`, error)
        // Fall through to in-memory fallback
      }
    }

    // Try TCP Redis
    if (this.redisClient) {
      try {
        const data = await this.redisClient.get(key)
        if (data) {
          const parsed = JSON.parse(data) as CacheEntry<T>
          // Check if expired
          if (Date.now() > parsed.expiresAt) {
            await this.del(key)
            return undefined
          }
          return parsed.value
        }
      } catch (error) {
        console.warn(`[Redis Cache] Get error for key "${key}":`, error)
        // Fall through to in-memory fallback
      }
    }

    // Fallback to in-memory
    return this.fallback.get<T>(key)
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlSeconds * 1000)
    const entry: CacheEntry<T> = { value, expiresAt }
    const ttlSeconds = Math.floor((ttlMs ?? this.defaultTtlSeconds * 1000) / 1000)

    // Try Upstash REST API first
    if (this.upstashClient) {
      try {
        // Upstash REST API - set with expiration
        await this.upstashClient.set(key, JSON.stringify(entry), { ex: ttlSeconds })
        // Also store in fallback for redundancy
        await this.fallback.set(key, value, ttlMs)
        return
      } catch (error) {
        console.warn(`[Upstash Cache] Set error for key "${key}":`, error)
        // Fall through to in-memory
      }
    }

    // Try TCP Redis
    if (this.redisClient) {
      try {
        await this.redisClient.setex(key, ttlSeconds, JSON.stringify(entry))
        // Also store in fallback for redundancy
        await this.fallback.set<T>(key, value, ttlMs)
        return
      } catch (error) {
        console.warn(`[Redis Cache] Set error for key "${key}":`, error)
        // Fall through to in-memory
      }
    }

    // Fallback to in-memory only
    await this.fallback.set<T>(key, value, ttlMs)
  }

  async del(key: string): Promise<void> {
    // Delete from Upstash, Redis, and fallback
    if (this.upstashClient) {
      try {
        await this.upstashClient.del(key)
      } catch (error) {
        console.warn(`[Upstash Cache] Delete error for key "${key}":`, error)
      }
    }
    if (this.redisClient) {
      try {
        await this.redisClient.del(key)
      } catch (error) {
        console.warn(`[Redis Cache] Delete error for key "${key}":`, error)
      }
    }
    await this.fallback.del(key)
  }

  async clear(): Promise<void> {
    // Clear in-memory fallback
    this.fallback.clear()
    if (this.upstashClient || this.redisClient) {
      console.warn("[Cache] clear() called - only clearing in-memory cache. Use Redis CLI to flush if needed.")
    }
  }

  isRedisAvailable(): boolean {
    return this.upstashClient !== null || this.redisClient !== null
  }

  getCacheType(): string {
    if (this.cacheType === "upstash") return "Upstash"
    if (this.cacheType === "redis") return "Redis"
    return "In-memory"
  }
}

// Create singleton cache instance
const globalCache = global as unknown as { __mgnrega_cache?: RedisCache }

if (!globalCache.__mgnrega_cache) {
  globalCache.__mgnrega_cache = new RedisCache(24 * 60 * 60 * 1000) // 24h default
}

export const cache = globalCache.__mgnrega_cache
