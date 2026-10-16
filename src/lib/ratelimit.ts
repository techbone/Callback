/**
 * Small in-memory sliding-window limiter. On serverless hosting each instance
 * keeps its own window, so this is a guard against runaway clients rather than
 * a hard quota. Swap for Upstash if abuse shows up.
 */
const windows = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const recent = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    windows.set(key, recent);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  windows.set(key, recent);
  if (windows.size > 5000) for (const [k, v] of windows) if (!v.some((t) => now - t < windowMs)) windows.delete(k);
  return { ok: true, retryAfterSec: 0 };
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}
