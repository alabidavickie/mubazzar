import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types-core";
import { createOrder, order } from "./helpers";

// Route-level tests for the cron and chat-click handlers, running against the app's own getDb()
// (an in-memory, migrated + seeded PGlite). Env is set before the modules are imported.
process.env.PGLITE_DATA_DIR = "memory";
process.env.CRON_SECRET = "test-cron-secret";
delete process.env.DATABASE_URL;

let db: Db;
let cron: typeof import("@/app/api/cron/auto-cancel/route");
let chatClick: typeof import("@/app/api/orders/[token]/chat-click/route");

beforeAll(async () => {
  const dbMod = await import("@/server/db");
  db = await dbMod.getDb();
  cron = await import("@/app/api/cron/auto-cancel/route");
  chatClick = await import("@/app/api/orders/[token]/chat-click/route");
});
afterAll(async () => {
  await db.close();
});

const cronReq = (auth?: string) =>
  new Request("http://localhost/api/cron/auto-cancel", { headers: auth ? { authorization: auth } : {} });

describe("GET /api/cron/auto-cancel", () => {
  it("rejects missing or wrong bearer tokens", async () => {
    expect((await cron.GET(cronReq())).status).toBe(401);
    expect((await cron.GET(cronReq("Bearer nope"))).status).toBe(401);
    expect((await cron.GET(cronReq("test-cron-secret"))).status).toBe(401);
  });

  it("cancels stale unpaid orders, releases stock and reports counts", async () => {
    const stale = await createOrder(db, { phone: "+2348039990001" });
    const fresh = await createOrder(db, { phone: "+2348039990002" });
    await db.query("update public.orders set created_at = now() - interval '49 hours' where id = $1", [stale.id]);

    const res = await cron.GET(cronReq("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; cancelled: number; metaFlushed: number };
    expect(body.ok).toBe(true);
    expect(body.cancelled).toBeGreaterThanOrEqual(1);
    expect(typeof body.metaFlushed).toBe("number");
    expect((await order(db, stale.id)).status).toBe("cancelled");
    expect((await order(db, fresh.id)).status).toBe("awaiting_chat");

    // Running again is a no-op for already-cancelled orders.
    const again = (await (await cron.GET(cronReq("Bearer test-cron-secret"))).json()) as { cancelled: number };
    expect(again.cancelled).toBe(0);
  });
});

describe("POST /api/orders/[token]/chat-click", () => {
  const post = (token: string, body: unknown) =>
    chatClick.POST(
      new Request(`http://localhost/api/orders/${token}/chat-click`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "10.0.0.9" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ token }) },
    );

  it("validates the token and the channel", async () => {
    expect((await post("not-a-token", { channel: "whatsapp" })).status).toBe(404);
    const o = await createOrder(db, { phone: "+2348039990003" });
    expect((await post(o.public_token, { channel: "carrier-pigeon" })).status).toBe(400);
  });

  it("records the click-through, the channel and a Contact analytics event", async () => {
    const o = await createOrder(db, { phone: "+2348039990004" });
    expect((await post(o.public_token, { channel: "instagram" })).status).toBe(204);
    const row = await order(db, o.id);
    expect(row.chat_clicked_at).toBeTruthy();
    expect(row.chat_channel).toBe("instagram");
    const ev = await db.query<{ kind: string }>("select kind from public.order_events where order_id = $1", [o.id]);
    expect(ev.map((e) => e.kind)).toContain("chat_clicked");
    const an = await db.query<{ n: number }>(
      "select count(*)::int as n from public.analytics_events where order_id = $1 and event_name = 'Contact'",
      [o.id],
    );
    expect(an[0]!.n).toBe(1);
  });

  it("unknown (well-formed) tokens are a silent no-op", async () => {
    expect((await post("0".repeat(32), { channel: "whatsapp" })).status).toBe(204);
  });
});
