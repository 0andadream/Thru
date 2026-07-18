/**
 * A tiny in-memory sliding-window rate limiter for the faucet route. This is
 * per-server-instance and best-effort — for production, back it with a shared
 * store (Redis / Upstash) or a real CAPTCHA. It exists to stop casual abuse of
 * the faucet from a single IP.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  // Drop timestamps outside the window.
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    retryAfterSeconds: 0,
  };
}

/** Occasionally clean up empty buckets to bound memory. */
export function sweep() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}
