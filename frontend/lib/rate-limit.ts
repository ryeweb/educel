/**
 * Distributed rate limiter using Upstash Redis
 * Works across multiple server instances (Vercel serverless functions)
 */

import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Initialize Redis client
// Falls back to in-memory for development if credentials not provided
let redis: Redis | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

// Fallback in-memory rate limiter for development
interface RateLimitEntry {
  count: number
  resetAt: number
}

class InMemoryRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map()
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  async check(identifier: string): Promise<{ success: boolean; limit: number; remaining: number; resetAt: number }> {
    const now = Date.now()
    const entry = this.limits.get(identifier)

    if (!entry || now > entry.resetAt) {
      const resetAt = now + this.windowMs
      this.limits.set(identifier, { count: 1, resetAt })
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        resetAt
      }
    }

    if (entry.count < this.maxRequests) {
      entry.count++
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - entry.count,
        resetAt: entry.resetAt
      }
    }

    return {
      success: false,
      limit: this.maxRequests,
      remaining: 0,
      resetAt: entry.resetAt
    }
  }
}

// Create rate limiters based on whether Redis is available
// Claude API: Higher limit for development (100/hour), lower for production (20/hour)
const isDevelopment = process.env.NODE_ENV !== 'production'
const claudeLimit = isDevelopment ? 100 : 20

const upstashClaudeRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(claudeLimit, '1 h'),
      analytics: true,
      prefix: 'ratelimit:claude',
    })
  : null

const inMemoryClaudeRateLimiter = new InMemoryRateLimiter(claudeLimit, 60 * 60 * 1000)

export const claudeRateLimiter = {
  check: async (identifier: string) => {
    if (upstashClaudeRateLimiter) {
      const result = await upstashClaudeRateLimiter.limit(identifier)
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        resetAt: result.reset, // Upstash uses 'reset' (timestamp in ms)
      }
    }
    return inMemoryClaudeRateLimiter.check(identifier)
  },
}

// Other API endpoints: 100 requests per minute per user
const upstashApiRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'ratelimit:api',
    })
  : null

const inMemoryApiRateLimiter = new InMemoryRateLimiter(100, 60 * 1000)

export const apiRateLimiter = {
  check: async (identifier: string) => {
    if (upstashApiRateLimiter) {
      const result = await upstashApiRateLimiter.limit(identifier)
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        resetAt: result.reset, // Upstash uses 'reset' (timestamp in ms)
      }
    }
    return inMemoryApiRateLimiter.check(identifier)
  },
}

/**
 * Helper function to check rate limit and return consistent response
 * Works with both Upstash and in-memory rate limiters
 */
export async function checkRateLimit(
  limiter: typeof claudeRateLimiter | typeof apiRateLimiter,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; resetAt: number }> {
  return limiter.check(identifier)
}
