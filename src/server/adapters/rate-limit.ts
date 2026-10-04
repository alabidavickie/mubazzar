import "server-only";
import { createHash } from "node:crypto";
import { asService } from "../db";
import { env } from "../env";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limiter stored in Postgres (works across serverless instances, no Redis).
 * `key` should already be namespaced, e.g. `order:ip:<hash>`.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = await asService((q) =>
    q.query<{ hits: number }>(
      `insert into public.rate_limits (key, window_start, hits) values ($1, $2, 1)
       on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
       returning hits`,
      [key, windowStart],
    ),
  );
  const hits = rows[0]?.hits ?? 1;
  // Opportunistic cleanup of old windows (cheap, bounded).
  if (Math.random() < 0.02) {
    void asService((q) => q.query("delete from public.rate_limits where window_start < now() - interval '1 day'"));
  }
  const retryAfterSeconds = Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now) / 1000);
  return { ok: hits <= limit, remaining: Math.max(limit - hits, 0), retryAfterSeconds };
}

/** Hash IPs before storing/using them as keys (privacy). */
export function hashIp(ip: string | null | undefined): string {
  return createHash("sha256")
    .update(`${env.ipHashSalt}:${ip ?? "unknown"}`)
    .digest("hex")
    .slice(0, 32);
}

/** Reads a fixed-window counter without incrementing it (e.g. "failed attempts so far"). */
export async function peekRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = await asService((q) =>
    q.query<{ hits: number }>("select hits from public.rate_limits where key = $1 and window_start = $2", [key, windowStart]),
  );
  const hits = rows[0]?.hits ?? 0;
  const retryAfterSeconds = Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now) / 1000);
  return { ok: hits < limit, remaining: Math.max(limit - hits, 0), retryAfterSeconds };
}
