import "server-only";

/**
 * Simple in-memory sliding-window rate limiter, keyed by IP + bucket.
 * For a single-instance deployment this is effective against brute force
 * and spam. (If you scale to multiple servers, swap for Redis.)
 */

type Window = { count: number; resetAt: number };
const globalForRl = globalThis as unknown as { __rl?: Map<string, Window> };
const windows = (globalForRl.__rl ??= new Map());

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  // Periodic cleanup so the map can't grow unbounded.
  if (windows.size > 10_000) {
    for (const [k, w] of windows) if (w.resetAt < now) windows.delete(k);
  }
  const w = windows.get(key);
  if (!w || w.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  w.count++;
  if (w.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export function clientIp(req: Request): string {
  // Behind a proxy (Vercel etc.) the platform sets x-forwarded-for.
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "local") || "local";
}
