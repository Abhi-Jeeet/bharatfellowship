// Upstash Redis client using REST API (better for serverless/Next.js)
import { Redis as UpstashRedis } from "@upstash/redis"

let upstashClient: UpstashRedis | null = null

/**
 * Get or create Upstash Redis client (REST API)
 * Returns null if Upstash is not configured
 */
export function getUpstashRedisClient(): UpstashRedis | null {
  if (upstashClient) {
    return upstashClient
  }

  const restUrl = process.env.UPSTASH_REDIS_REST_URL
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!restUrl || !restToken) {
    console.log("[Upstash Redis] Not configured - UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set.")
    return null
  }

  try {
    upstashClient = new UpstashRedis({
      url: restUrl,
      token: restToken,
    })
    console.log("[Upstash Redis] Client initialized successfully")
    return upstashClient
  } catch (error) {
    console.error("[Upstash Redis] Failed to create client:", error)
    return null
  }
}

