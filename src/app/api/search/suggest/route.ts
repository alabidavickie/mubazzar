import { NextResponse } from "next/server";
import { searchSuggestions } from "@/server/services/catalog";
import { hashIp, rateLimit } from "@/server/adapters/rate-limit";

export interface SuggestResponse {
  items: { slug: string; name: string; priceKobo: number; imageUrl: string | null }[];
}

/** Instant search suggestions (Postgres FTS, read as anon). Rate-limited per hashed IP. */
export async function GET(req: Request) {
  const term = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (term.length < 2) return NextResponse.json({ items: [] } satisfies SuggestResponse);
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limited = await rateLimit(`suggest:${hashIp(ip)}`, 90, 60);
  if (!limited.ok) {
    return NextResponse.json(
      { items: [] } satisfies SuggestResponse,
      { status: 429, headers: { "retry-after": String(limited.retryAfterSeconds) } },
    );
  }
  const items = await searchSuggestions(term, 6);
  return NextResponse.json({ items } satisfies SuggestResponse, {
    headers: { "cache-control": "private, max-age=60" },
  });
}
