/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Good enough to stop password guessing against a single server process.
 * On multi-instance / serverless hosting each instance keeps its own counters,
 * so treat this as a speed bump — use a shared store (e.g. Redis) for a hard limit.
 */
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()

  // Occasionally drop expired buckets so the map can't grow forever
  if (now - lastSweep > windowMs) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
    lastSweep = now
  }

  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }
  bucket.count += 1

  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  }
}

export function resetRateLimit(key: string) {
  buckets.delete(key)
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}
