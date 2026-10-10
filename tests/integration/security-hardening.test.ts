import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types-core";
import { as, createOrder, freshDb, ids, inventory, order, rejects, VACUUM } from "./helpers";

/** Regression tests for the 2026-10-06 security audit — each reproduces a proven exploit. */
let db: Db;
let seq = 0;
const phone = () => `+234805${String(1_000_000 + ++seq).slice(-7)}`;

beforeAll(async () => {
  db = await freshDb();
});
afterAll(async () => {
  await db.close();
});

describe("H2 — stock hoarding", () => {
  it("caps units of one product per order", async () => {
    await rejects(
      createOrder(db, { phone: phone(), items: [{ product_id: ids.product(VACUUM), bundle_id: ids.bundle(VACUUM, "3x"), packs: 4 }] }),
      /TOO_MANY_UNITS/,
    );
    await rejects(
      createOrder(db, {
        phone: phone(),
        items: [
          { product_id: ids.product(VACUUM), bundle_id: ids.bundle(VACUUM, "3x"), packs: 3 },
          { product_id: ids.product(VACUUM), bundle_id: null, packs: 2 },
        ],
      }),
      /TOO_MANY_UNITS/,
    );
  });

  it("caps open unpaid orders per phone", async () => {
    const p = phone();
    for (let i = 0; i < 3; i++) await createOrder(db, { phone: p });
    await rejects(createOrder(db, { phone: p }), /TOO_MANY_OPEN_ORDERS/);
  });

  it("auto-cancels self-claimed orders that staff never confirmed, releasing stock", async () => {
    const before = await inventory(db, VACUUM, "warehouse");
    const o = await createOrder(db, { phone: phone(), state: "Rivers" }); // Rivers ships from the warehouse
    await db.query("select public.claim_payment((select public_token from public.orders where id = $1))", [o.id]);
    await db.query("update public.orders set created_at = now() - interval '73 hours' where id = $1", [o.id]);
    await db.query("select public.cancel_stale_orders()");
    expect((await order(db, o.id)).status).toBe("cancelled");
    expect((await inventory(db, VACUUM, "warehouse")).reserved).toBe(before.reserved);
  });

  it("keeps recently claimed orders", async () => {
    const o = await createOrder(db, { phone: phone() });
    await db.query("select public.claim_payment((select public_token from public.orders where id = $1))", [o.id]);
    await db.query("update public.orders set created_at = now() - interval '50 hours' where id = $1", [o.id]);
    await db.query("select public.cancel_stale_orders()");
    expect((await order(db, o.id)).status).toBe("awaiting_chat");
  });
});

describe("L8 — idempotency key replay", () => {
  it("never returns another phone's order (and its token) for a reused key", async () => {
    const key = crypto.randomUUID();
    await createOrder(db, { phone: phone(), extra: { idempotency_key: key } });
    await rejects(createOrder(db, { phone: phone(), extra: { idempotency_key: key } }), /IDEMPOTENCY_CONFLICT/);
  });
});

describe("M1 — dispatcher collections", () => {
  async function dispatched(pod: boolean) {
    const o = await createOrder(db, { phone: phone() });
    const staff = as(db, "staff");
    if (pod) await staff((q) => q.query("select public.set_payment_agreement($1, 'pay_on_delivery')", [o.id]));
    await staff((q) => q.query("select public.set_order_status($1, 'confirmed')", [o.id]));
    await staff((q) => q.query("select public.assign_dispatcher($1, $2)", [o.id, ids.user("dispatcher")]));
    return o;
  }

  it("rejects collections on orders where pay-on-delivery was not agreed", async () => {
    const o = await dispatched(false);
    await rejects(
      as(db, "dispatcher")((q) => q.query("select public.complete_delivery($1, 100000, 'pay_on_delivery')", [o.id])),
      /COLLECTION_NOT_AGREED/,
    );
  });

  it("rejects bank-transfer 'collections' and amounts above the balance", async () => {
    const o = await dispatched(true);
    const rider = as(db, "dispatcher");
    await rejects(rider((q) => q.query("select public.complete_delivery($1, 100000, 'bank_transfer')", [o.id])), /INVALID_METHOD/);
    await rejects(
      rider((q) => q.query("select public.complete_delivery($1, $2, 'pay_on_delivery')", [o.id, o.total_kobo * 10])),
      /AMOUNT_EXCEEDS_BALANCE/,
    );
    const ok = await rider((q) =>
      q.query<{ r: { payment_status: string } }>("select public.complete_delivery($1, $2, 'pos_on_delivery') as r", [o.id, o.total_kobo]),
    );
    expect(ok[0]!.r.payment_status).toBe("paid");
  });
});

describe("M2 — staff can only change money and orders through audited functions", () => {
  it("staff cannot insert payments directly", async () => {
    const o = await createOrder(db, { phone: phone() });
    await rejects(
      as(db, "staff")((q) =>
        q.query(
          "insert into public.payments (order_id, amount_kobo, method, recorded_by, recorded_by_role) values ($1, 999999999, 'bank_transfer', $2, 'admin')",
          [o.id, ids.user("staff")],
        ),
      ),
      /permission denied/,
    );
  });

  it("staff cannot rewrite tokens, ownership or timestamps", async () => {
    const o = await createOrder(db, { phone: phone() });
    await rejects(
      as(db, "staff")((q) => q.query("update public.orders set user_id = $2, public_token = repeat('a', 32) where id = $1", [o.id, ids.user("customer")])),
      /permission denied/,
    );
  });

  it("staff edit delivery details only via update_order_details, which is audited", async () => {
    const o = await createOrder(db, { phone: phone() });
    await as(db, "staff")((q) => q.query("select public.update_order_details($1, $2::jsonb)", [o.id, { landmark: "Opposite Shoprite" }]));
    expect((await order(db, o.id)).landmark).toBe("Opposite Shoprite");
    const audit = await db.query<{ action: string }>("select action from public.audit_log where entity_id = $1 and action = 'order.edit'", [o.id]);
    expect(audit).toHaveLength(1);
    await rejects(
      as(db, "staff")((q) => q.query("select public.update_order_details($1, $2::jsonb)", [o.id, { total_kobo: 1 }])),
      /FIELD_NOT_EDITABLE/,
    );
    await rejects(
      as(db, "customer")((q) => q.query("select public.update_order_details($1, $2::jsonb)", [o.id, { landmark: "x" }])),
      /FORBIDDEN/,
    );
  });
});

describe("L6 — guarded profile fields", () => {
  it("customers cannot change their hub or email; phone/name edits still work", async () => {
    await rejects(
      as(db, "customer")((q) => q.query("update public.profiles set hub_code = 'lagos' where id = $1", [ids.user("customer")])),
      /FORBIDDEN/,
    );
    await rejects(
      as(db, "customer")((q) => q.query("update public.profiles set email = 'admin@mubazzar.test' where id = $1", [ids.user("customer")])),
      /FORBIDDEN/,
    );
    const ok = await as(db, "customer")((q) =>
      q.query("update public.profiles set full_name = 'Chinedu C.' where id = $1 returning id", [ids.user("customer")]),
    );
    expect(ok).toHaveLength(1);
  });
});

describe("L9 — free gift threshold counts the product's own lines", () => {
  it("doesn't give a gift because other products filled the cart", async () => {
    await db.query("update public.free_gifts set min_order_kobo = 2000000 where product_id = $1", [ids.product(VACUUM)]);
    const o = await createOrder(db, {
      phone: phone(),
      items: [
        { product_id: ids.product(VACUUM), bundle_id: ids.bundle(VACUUM, "1x"), packs: 1 },
        { product_id: ids.product("portable-power-station-300w"), bundle_id: null, packs: 1 },
      ],
    });
    const gifts = await db.query("select 1 from public.order_items where order_id = $1 and is_free_gift", [o.id]);
    expect(gifts).toHaveLength(0);
    await db.query("update public.free_gifts set min_order_kobo = 0 where product_id = $1", [ids.product(VACUUM)]);
  });
});

describe("L12 — tracking is only reachable through the app", () => {
  it("anon and signed-in users cannot call track_order directly", async () => {
    await rejects(as(db, "anon")((q) => q.query("select public.track_order('MBZ-222222', '+2348031234567')")), /permission denied/);
    await rejects(as(db, "customer")((q) => q.query("select public.track_order('MBZ-222222', '+2348031234567')")), /permission denied/);
  });
});
