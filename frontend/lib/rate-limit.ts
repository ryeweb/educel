/**
 * Simple in-memory rate limiter for MVP
 * For production with multiple servers, upgrade to Redis/Upstash
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map()
  private readonly maxRequests: number
  private readonly windowMs: number
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs

    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  async check(identifier: string): Promise<{ success: boolean; limit: number; remaining: number; resetAt: number }> {
    const now = Date.now()
    const entry = this.limits.get(identifier)

    // No previous requests or window expired
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

    // Within rate limit
    if (entry.count < this.maxRequests) {
      entry.count++
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - entry.count,
        resetAt: entry.resetAt
      }
    }

    // Rate limit exceeded
    return {
      success: false,
      limit: this.maxRequests,
      remaining: 0,
      resetAt: entry.resetAt
    }
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetAt) {
        this.limits.delete(key)
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

// Rate limiters for different endpoints
// Claude API: 20 requests per hour per user (conservative for cost control)
export const claudeRateLimiter = new RateLimiter(20, 60 * 60 * 1000)

// Other API endpoints: 100 requests per minute per user
export const apiRateLimiter = new RateLimiter(100, 60 * 1000)
