import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types-core";
import { computePaymentStatus, type PaymentStatus } from "@/lib/payments/status";
import { as, createOrder, freshDb, ids, inventory, order, rejects, VACUUM } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});
afterAll(async () => {
  await db.close();
});

describe("create_order", () => {
  it("prices from the DB, reserves stock in the state's hub, adds the free gift and logs the event", async () => {
    const before = await inventory(db, VACUUM, "lagos");
    const o = await createOrder(db); // 2x bundle to Lagos
    expect(o.total_kobo).toBe(3_500_000 + 250_000);
    const row = await order(db, o.id);
    expect(row).toMatchObject({ status: "awaiting_chat", payment_status: "unpaid", subtotal_kobo: 3_500_000, delivery_fee_kobo: 250_000 });
    expect(row.hub_id).toBe(ids.hub("lagos"));
    expect(row.order_number).toMatch(/^MBZ-[A-Z0-9]{6}$/);
    expect(row.public_token).toMatch(/^[0-9a-f]{32}$/);

    const after = await inventory(db, VACUUM, "lagos");
    expect(after.reserved - before.reserved).toBe(2);
    expect(after.on_hand).toBe(before.on_hand);

    const items = await db.query<{ name: string; units: number; is_free_gift: boolean; line_total_kobo: number }>(
      "select name, units, is_free_gift, line_total_kobo from public.order_items where order_id = $1 order by is_free_gift",
      [o.id],
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ units: 2, is_free_gift: false, line_total_kobo: 3_500_000 });
    expect(items[1]).toMatchObject({ is_free_gift: true, line_total_kobo: 0, name: "FREE: Luxury Aromatherapy Car Diffuser" });

    const events = await db.query<{ kind: string }>("select kind from public.order_events where order_id = $1", [o.id]);
    expect(events.map((e) => e.kind)).toContain("created");
  });

  it("ignores client-supplied prices and totals (price tampering)", async () => {
    const o = await createOrder(db, {
      items: [
        {
          product_id: ids.product(VACUUM),
          bundle_id: ids.bundle(VACUUM, "3x"),
          packs: 1,
          unit_price_kobo: 100,
          line_total_kobo: 100,
        } as never,
      ],
      extra: { total_kobo: 100, subtotal_kobo: 100, delivery_fee_kobo: 0 },
    });
    expect(o.total_kobo).toBe(4_900_000 + 250_000);
  });

  it("rejects a bundle that belongs to another product", async () => {
    await rejects(
      createOrder(db, {
        items: [{ product_id: ids.product("electric-veggie-chopper"), bundle_id: ids.bundle(VACUUM, "2x"), packs: 1 }],
      }),
      /BUNDLE_UNAVAILABLE/,
    );
  });

  it("rejects unknown states and invalid phone formats", async () => {
    await rejects(createOrder(db, { state: "Atlantis" }), /INVALID_STATE/);
    await rejects(createOrder(db, { phone: "08031234567" }), /orders_phone_e164_check|check constraint/);
  });

  it("returns the existing order for a repeated idempotency key", async () => {
    const key = crypto.randomUUID();
    const a = await createOrder(db, { extra: { idempotency_key: key } });
    const b = await createOrder(db, { extra: { idempotency_key: key } });
    expect(b).toMatchObject({ id: a.id, existing: true });
  });

  it("falls back to another hub when the state's hub lacks stock", async () => {
    const slug = "smart-anti-snore-device";
    await db.query("update public.inventory set on_hand = 0, reserved = 0 where product_id = $1 and hub_id = $2", [
      ids.product(slug),
      ids.hub("lagos"),
    ]);
    const o = await createOrder(db, { items: [{ product_id: ids.product(slug), packs: 2 }] });
    expect((await order(db, o.id)).hub_id).toBe(ids.hub("warehouse"));
  });
});

describe("no oversell under concurrency", () => {
  it("only one of several simultaneous orders gets the last unit", async () => {
    const slug = "mini-hd-phone-projector";
    await db.query("update public.inventory set on_hand = 0, reserved = 0 where product_id = $1", [ids.product(slug)]);
    await db.query("update public.inventory set on_hand = 1 where product_id = $1 and hub_id = $2", [ids.product(slug), ids.hub("lagos")]);
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        createOrder(db, { items: [{ product_id: ids.product(slug), packs: 1 }], phone: `+23480312345${10 + i}` }),
      ),
    );
    const ok = attempts.filter((a) => a.status === "fulfilled");
    const failed = attempts.filter((a) => a.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(5);
    for (const f of failed) expect(String(f.reason.message)).toMatch(/OUT_OF_STOCK/);
    const inv = await inventory(db, slug, "lagos");
    expect(inv).toEqual({ on_hand: 1, reserved: 1 });
  });
});

describe("status transitions and stock", () => {
  it("cancel releases reserved stock; invalid transitions are rejected", async () => {
    const before = await inventory(db, VACUUM, "lagos");
    const o = await createOrder(db);
    await as(db, "staff")((q) => q.query("select public.set_order_status($1, 'cancelled', 'Customer changed mind')", [o.id]));
    const after = await inventory(db, VACUUM, "lagos");
    expect(after.reserved).toBe(before.reserved);
    await rejects(
      as(db, "staff")((q) => q.query("select public.set_order_status($1, 'confirmed')", [o.id])),
      /INVALID_TRANSITION/,
    );
    const events = await db.query<{ kind: string; to_status: string | null }>(
      "select kind, to_status from public.order_events where order_id = $1 order by id",
      [o.id],
    );
    expect(events.at(-1)).toMatchObject({ kind: "status_changed", to_status: "cancelled" });
  });

  it("delivery deducts on_hand and reserved; failed delivery releases the reservation", async () => {
    const start = await inventory(db, VACUUM, "lagos");
    const delivered = await createOrder(db);
    const failed = await createOrder(db);
    const staff = as(db, "staff");
    for (const id of [delivered.id, failed.id]) {
      await staff((q) => q.query("select public.set_order_status($1, 'confirmed')", [id]));
      await staff((q) => q.query("select public.assign_dispatcher($1, $2)", [id, ids.user("dispatcher")]));
    }
    await as(db, "dispatcher")((q) => q.query("select public.complete_delivery($1, 0, null, null, 'Delivered')", [delivered.id]));
    await as(db, "dispatcher")((q) => q.query("select public.fail_delivery($1, 'Customer unreachable')", [failed.id]));
    const end = await inventory(db, VACUUM, "lagos");
    expect(end.on_hand).toBe(start.on_hand - 2);
    expect(end.reserved).toBe(start.reserved);
    expect((await order(db, delivered.id)).status).toBe("delivered");
    expect((await order(db, failed.id)).status).toBe("failed_delivery");
  });
});

describe("unpaid auto-cancel", () => {
  it("cancels stale awaiting_chat orders and releases stock, leaving fresh and claimed ones", async () => {
    // Sum across hubs: earlier tests may have exhausted Lagos, so orders can fall back to the warehouse.
    const reservedTotal = async () =>
      (await db.query<{ r: number }>("select sum(reserved)::int as r from public.inventory where product_id = $1", [ids.product(VACUUM)]))[0]!.r;
    const before = await reservedTotal();
    const stale = await createOrder(db);
    const claimed = await createOrder(db);
    const fresh = await createOrder(db);
    await db.query("update public.orders set created_at = now() - interval '49 hours' where id in ($1, $2)", [stale.id, claimed.id]);
    await db.query("select public.claim_payment((select public_token from public.orders where id = $1))", [claimed.id]);
    const [{ n }] = await db.query<{ n: number }>("select public.cancel_stale_orders() as n");
    expect(n).toBeGreaterThanOrEqual(1);
    expect((await order(db, stale.id)).status).toBe("cancelled");
    expect((await order(db, claimed.id)).status).toBe("awaiting_chat");
    expect((await order(db, fresh.id)).status).toBe("awaiting_chat");
    expect((await reservedTotal()) - before).toBe(4); // claimed + fresh still reserved (2 units each)
    const ev = await db.query<{ kind: string }>("select kind from public.order_events where order_id = $1", [stale.id]);
    expect(ev.map((e) => e.kind)).toContain("auto_cancelled");
  });
});

describe("payment status SQL mirrors the TypeScript implementation", () => {
  const statuses: PaymentStatus[] = ["unpaid", "payment_claimed", "pay_on_delivery"];
  const cases: [number, number, number, boolean][] = [
    [100, 0, 0, false],
    [100, 0, 0, true],
    [100, 40, 0, false],
    [100, 100, 0, false],
    [100, 150, 0, true],
    [100, 100, 100, false],
    [100, 100, 30, false],
    [100, 50, 60, false],
  ];
  it("agrees on every case", async () => {
    for (const [total, paid, refunded, pod] of cases) {
      for (const current of statuses) {
        const [{ s }] = await db.query<{ s: string }>(
          "select public.compute_payment_status($1, $2, $3, $4, $5::public.payment_status) as s",
          [total, paid, refunded, pod, current],
        );
        const ts = computePaymentStatus(
          total,
          [
            ...(paid ? [{ kind: "payment" as const, amountKobo: paid }] : []),
            ...(refunded ? [{ kind: "refund" as const, amountKobo: refunded }] : []),
          ],
          { podAgreed: pod, current },
        ).status;
        expect(s, JSON.stringify({ total, paid, refunded, pod, current })).toBe(ts);
      }
    }
  });
});
