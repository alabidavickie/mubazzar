import { NextResponse } from "next/server";
import { asAnon, asService } from "@/server/db";
import { SCHEMA_CURRENT_SQL } from "@/server/schema-compat";

export const dynamic = "force-dynamic";

/** Liveness + DB readiness probe (used by Playwright's webServer and uptime monitors). */
export async function GET() {
  try {
    const rows = await asAnon((q) => q.query<{ n: number }>("select count(*)::int as n from public.categories"));
    // The code needs the security-hardening migration; flag a database that is still behind it.
    const schema = await asService((q) => q.query<{ ok: boolean }>(SCHEMA_CURRENT_SQL)); // information_schema only lists columns the role may see
    if (!schema[0]?.ok) {
      console.error("[health] database schema is behind the code: apply migration 20261006000500_security_hardening.sql");
      return NextResponse.json({ ok: false, categories: rows[0]?.n ?? 0, error: "database migrations pending" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, categories: rows[0]?.n ?? 0 });
  } catch (e) {
    console.error("[health] database check failed", e);
    return NextResponse.json({ ok: false, error: "database unavailable" }, { status: 503 });
  }
}
