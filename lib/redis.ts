import Redis from "ioredis"

// Redis client singleton (for TCP connections)
let redisClient: Redis | null = null

/**
 * Get or create Redis client instance (TCP connection)
 * Returns null if Redis is not configured or unavailable
 */
export function getRedisClient(): Redis | null {
  // Return existing client if already created
  if (redisClient) {
    return redisClient
  }

  // Check if Redis URL is configured
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST
  if (!redisUrl) {
    return null
  }

  try {
    // Create Redis client
    // Supports both REDIS_URL (for Redis Cloud, Upstash TCP, etc.) and individual host/port
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      })
    } else {
      redisClient = new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      })
    }

    // Handle connection events
    redisClient.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message)
    })

    redisClient.on("connect", () => {
      console.log("[Redis] Connecting...")
    })

    redisClient.on("ready", () => {
      console.log("[Redis] Connected and ready")
    })

    redisClient.on("close", () => {
      console.log("[Redis] Connection closed")
    })

    // Attempt to connect (non-blocking)
    redisClient.connect().catch((err) => {
      console.warn("[Redis] Failed to connect:", err.message)
    })

    return redisClient
  } catch (error) {
    console.error("[Redis] Failed to create client:", error)
    return null
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}

