import { NextResponse } from "next/server";
import { asAnon, asService } from "@/server/db";
import { authSecretConfigured } from "@/server/adapters/auth";
import { SCHEMA_CURRENT_SQL } from "@/server/schema-compat";

export const dynamic = "force-dynamic";

/**
 * Liveness + DB readiness probe (used by Playwright's webServer and uptime monitors). The response never
 * carries internal detail (paths, hosts, usernames): the reason goes to the server log only.
 */
export async function GET() {
  if (!authSecretConfigured()) {
    console.error("[health] AUTH_SECRET is missing or shorter than 32 characters — sign-in is disabled");
    return NextResponse.json({ ok: false, error: "not ready" }, { status: 503 });
  }
  try {
    const rows = await asAnon((q) => q.query<{ n: number }>("select count(*)::int as n from public.categories"));
    // The code needs the security-hardening migration; flag a database that is still behind it.
    const schema = await asService((q) => q.query<{ ok: boolean }>(SCHEMA_CURRENT_SQL)); // information_schema only lists columns the role may see
    if (!schema[0]?.ok) {
      console.error("[health] database schema is behind the code: apply the pending migrations in supabase/migrations");
      return NextResponse.json({ ok: false, error: "not ready" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, categories: rows[0]?.n ?? 0 });
  } catch (e) {
    console.error("[health] database check failed:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "not ready" }, { status: 503 });
  }
}
