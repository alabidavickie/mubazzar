import { NextResponse } from "next/server";
import { asAnon } from "@/server/db";
import { authSecretConfigured } from "@/server/adapters/auth";

export const dynamic = "force-dynamic";

/** Liveness + DB readiness probe (used by Playwright's webServer and uptime monitors). */
export async function GET() {
  if (!authSecretConfigured()) {
    console.error("[health] AUTH_SECRET is missing or shorter than 32 characters — sign-in is disabled");
    return NextResponse.json({ ok: false, error: "not ready" }, { status: 503 });
  }
  try {
    const rows = await asAnon((q) => q.query<{ n: number }>("select count(*)::int as n from public.categories"));
    return NextResponse.json({ ok: true, categories: rows[0]?.n ?? 0 });
  } catch (e) {
    // The detail (paths, hosts, usernames) goes to the server log, never to a public endpoint.
    console.error("[health] database check failed:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "not ready" }, { status: 503 });
  }
}
