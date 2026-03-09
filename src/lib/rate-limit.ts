/**
 * In-memory rate limiter for API routes.
 *
 * Uses a sliding window counter per key. Suitable for single-instance
 * deployments on Vercel (each serverless function instance has its own
 * map, so limits are per-instance — still effective against rapid bursts).
 *
 * For distributed rate limiting, swap this for @upstash/ratelimit + Redis.
 */

import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 60 seconds to prevent memory leaks
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  store.forEach((entry, key) => {
    if (entry.resetAt <= now) {
      store.delete(key)
    }
  })
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number
  /** Window duration in seconds */
  windowSeconds: number
}

/** Default tiers for different endpoint categories */
export const RATE_LIMITS = {
  /** Standard authenticated endpoints */
  standard: { limit: 60, windowSeconds: 60 } as RateLimitConfig,
  /** AI/LLM generation endpoints (expensive) */
  ai: { limit: 10, windowSeconds: 60 } as RateLimitConfig,
  /** Bulk operations */
  bulk: { limit: 5, windowSeconds: 60 } as RateLimitConfig,
  /** Webhook receivers (high volume expected) */
  webhook: { limit: 200, windowSeconds: 60 } as RateLimitConfig,
  /** Auth-related endpoints */
  auth: { limit: 10, windowSeconds: 60 } as RateLimitConfig,
}

/**
 * Check rate limit for a given key.
 * Returns { allowed, remaining, resetAt } or a 429 NextResponse.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: true; remaining: number } | { allowed: false; response: NextResponse } {
  cleanup()

  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 })
    return { allowed: true, remaining: config.limit - 1 }
  }

  if (entry.count >= config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Too many requests', retry_after: retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(config.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
          },
        }
      ),
    }
  }

  entry.count++
  return { allowed: true, remaining: config.limit - entry.count }
}

/**
 * Helper to build a rate limit key from user ID and route path.
 */
export function rateLimitKey(userId: string, route: string): string {
  return `${userId}:${route}`
}

/**
 * Helper to build a rate limit key from IP address (for unauthenticated endpoints).
 */
export function rateLimitKeyByIP(request: Request, route: string): string {
  const forwarded = (request.headers as any).get?.('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  return `ip:${ip}:${route}`
}
