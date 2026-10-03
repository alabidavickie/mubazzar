import { NextResponse } from "next/server";
import { asAnon } from "@/server/db";

export const dynamic = "force-dynamic";

/** Liveness + DB readiness probe (used by Playwright's webServer and uptime monitors). */
export async function GET() {
  try {
    const rows = await asAnon((q) => q.query<{ n: number }>("select count(*)::int as n from public.categories"));
    return NextResponse.json({ ok: true, categories: rows[0]?.n ?? 0 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 503 });
  }
}
