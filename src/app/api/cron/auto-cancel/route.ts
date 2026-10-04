import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { asService } from "@/server/db";
import { env } from "@/server/env";
import { flushMetaEvents } from "@/server/adapters/meta";

export const dynamic = "force-dynamic";

function authorized(header: string | null): boolean {
  if (!env.cronSecret) return false; // never open when the secret is not configured
  const expected = Buffer.from(`Bearer ${env.cronSecret}`);
  const got = Buffer.from(header ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/**
 * Vercel Cron (every 30 min, see vercel.json): cancels unpaid orders that stayed in
 * `awaiting_chat` past `auto_cancel_hours` (releasing their reserved stock), then flushes queued
 * Meta CAPI events (Purchase). Requires `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(req: Request) {
  if (!authorized(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const rows = await asService((q) => q.query<{ n: number }>("select public.cancel_stale_orders() as n"));
  const cancelled = Number(rows[0]?.n ?? 0);
  let metaFlushed = 0;
  try {
    metaFlushed = await flushMetaEvents(50);
  } catch (e) {
    console.error("[cron:auto-cancel] meta flush failed", e);
  }
  return NextResponse.json({ ok: true, cancelled, metaFlushed });
}
