import { NextResponse } from "next/server";
import { z } from "zod";
import { chatChannelSchema } from "@/lib/schemas/order";
import { hashIp, rateLimit } from "@/server/adapters/rate-limit";
import { logChatClick } from "@/server/services/orders";

const bodySchema = z.object({ channel: chatChannelSchema });

/**
 * Records that the customer clicked through to a chat channel from the thank-you / track page
 * (order.chat_clicked_at + order_events + analytics `Contact`). Requires the unguessable order token.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[0-9a-f]{32}$/.test(token)) return NextResponse.json({ ok: false }, { status: 404 });
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limited = await rateLimit(`chat-click:${hashIp(ip)}`, 30, 600);
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: 429, headers: { "retry-after": String(limited.retryAfterSeconds) } });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await logChatClick(token, parsed.data.channel);
  } catch (e) {
    console.error("[chat-click] failed", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
