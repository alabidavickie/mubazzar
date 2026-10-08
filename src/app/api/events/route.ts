import { NextResponse } from "next/server";
import { z } from "zod";
import { asService } from "@/server/db";
import { rateLimit, hashIp } from "@/server/adapters/rate-limit";

const schema = z.object({
  name: z.enum(["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Lead", "Contact"]),
  eventId: z.string().max(120).optional(),
  path: z.string().max(500).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

/** First-party analytics sink mirroring browser Pixel events (for the admin conversion reports). */
export async function POST(req: Request) {
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limited = await rateLimit(`events:${hashIp(ip)}`, 120, 60);
  if (!limited.ok) return new NextResponse(null, { status: 204 });
  if (Number(req.headers.get("content-length") ?? 0) > 8_192) return new NextResponse(null, { status: 413 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { name, eventId, path, data } = parsed.data;
  const url = path ? new URL(path, "http://x") : null;
  const lpSlug = url?.pathname.startsWith("/lp/") ? url.pathname.split("/")[2] : null;
  await asService((q) =>
    q.query(
      `insert into public.analytics_events (event_name, event_id, path, landing_page_id, utm_source, utm_medium, utm_campaign, data)
       values ($1, $2, $3, (select id from public.landing_pages where slug = $4), $5, $6, $7, $8)`,
      [
        name,
        eventId ?? null,
        path?.slice(0, 500) ?? null,
        lpSlug,
        url?.searchParams.get("utm_source")?.slice(0, 200) ?? null,
        url?.searchParams.get("utm_medium")?.slice(0, 200) ?? null,
        url?.searchParams.get("utm_campaign")?.slice(0, 200) ?? null,
        // Oversized extra data is dropped whole (cutting JSON in half would make it unreadable).
        (JSON.stringify(data ?? {}).length <= 4000 ? (data ?? {}) : {}),
      ],
    ),
  ).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}
