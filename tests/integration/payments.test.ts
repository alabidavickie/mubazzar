import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types-core";
import { as, createOrder, freshDb, ids, inventory, order, rejects, VACUUM } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});
afterAll(async () => {
  await db.close();
});

const purchaseEvents = async (orderId: string) =>
  (await db.query<{ n: number }>("select count(*)::int as n from public.meta_events where order_id = $1 and event_name = 'Purchase'", [orderId]))[0]!.n;

describe("manual payment recording", () => {
  it("partial then balance → paid, with payment rows, events and audit log", async () => {
    const o = await createOrder(db); // ₦37,500
    const staff = as(db, "staff");
    const r1 = await staff((q) =>
      q.query<{ r: Record<string, unknown> }>("select public.record_payment($1, 1500000, 'bank_transfer', 'TRF-001', 'Deposit') as r", [o.id]),
    );
    expect(r1[0]!.r).toMatchObject({ payment_status: "part_paid", balance_kobo: 2_250_000, is_overpaid: false });
    expect(await purchaseEvents(o.id)).toBe(0);

    const r2 = await staff((q) =>
      q.query<{ r: Record<string, unknown> }>("select public.record_payment($1, 2250000, 'bank_transfer', 'TRF-002') as r", [o.id]),
    );
    expect(r2[0]!.r).toMatchObject({ payment_status: "paid", balance_kobo: 0 });

    const row = await order(db, o.id);
    expect(row).toMatchObject({ payment_status: "paid", amount_paid_kobo: 3_750_000 });
    expect(row.paid_at).not.toBeNull();

    const payments = await db.query<{ amount_kobo: number; recorded_by: string; recorded_by_role: string }>(
      "select amount_kobo, recorded_by, recorded_by_role from public.payments where order_id = $1 order by created_at",
      [o.id],
    );
    expect(payments.map((p) => p.amount_kobo)).toEqual([1_500_000, 2_250_000]);
    expect(payments.every((p) => p.recorded_by === ids.user("staff") && p.recorded_by_role === "staff")).toBe(true);

    const audit = await db.query<{ action: string }>(
      "select action from public.audit_log where entity = 'order' and entity_id = $1 and action = 'payment.record'",
      [o.id],
    );
    expect(audit).toHaveLength(2);
    expect(await purchaseEvents(o.id)).toBe(1);
  });

  it("flags overpayment", async () => {
    const o = await createOrder(db);
    const r = await as(db, "staff")((q) =>
      q.query<{ r: Record<string, unknown> }>("select public.record_payment($1, 4000000, 'bank_transfer') as r", [o.id]),
    );
    expect(r[0]!.r).toMatchObject({ payment_status: "paid", is_overpaid: true });
    expect((await order(db, o.id)).is_overpaid).toBe(true);
  });

  it("rejects zero/negative amounts and payments on cancelled orders", async () => {
    const o = await createOrder(db);
    const staff = as(db, "staff");
    await rejects(staff((q) => q.query("select public.record_payment($1, 0, 'bank_transfer')", [o.id])), /INVALID_AMOUNT/);
    await staff((q) => q.query("select public.set_order_status($1, 'cancelled')", [o.id]));
    await rejects(staff((q) => q.query("select public.record_payment($1, 1000, 'bank_transfer')", [o.id])), /ORDER_CANCELLED/);
  });

  it("rejects customers and dispatchers", async () => {
    const o = await createOrder(db, { extra: { user_id: ids.user("customer") } });
    await rejects(as(db, "customer")((q) => q.query("select public.record_payment($1, 1000, 'bank_transfer')", [o.id])), /FORBIDDEN/);
    await rejects(as(db, "dispatcher")((q) => q.query("select public.record_payment($1, 1000, 'bank_transfer')", [o.id])), /FORBIDDEN/);
  });
});

describe("Purchase (Meta CAPI) fires exactly once", () => {
  it("queues Purchase when first paid, not again when delivered", async () => {
    const o = await createOrder(db);
    const staff = as(db, "staff");
    await staff((q) => q.query("select public.record_payment($1, 3750000, 'bank_transfer')", [o.id]));
    await staff((q) => q.query("select public.set_order_status($1, 'confirmed')", [o.id]));
    await staff((q) => q.query("select public.assign_dispatcher($1, $2)", [o.id, ids.user("dispatcher")]));
    await as(db, "dispatcher")((q) => q.query("select public.complete_delivery($1)", [o.id]));
    expect(await purchaseEvents(o.id)).toBe(1);
    const [ev] = await db.query<{ event_id: string; payload: { trigger: string; value_kobo: number } }>(
      "select event_id, payload from public.meta_events where order_id = $1",
      [o.id],
    );
    expect(ev).toMatchObject({ event_id: `purchase-${o.id}`, payload: { trigger: "paid", value_kobo: 3_750_000 } });
  });

  it("is not queued for unpaid, undelivered orders", async () => {
    const o = await createOrder(db);
    await as(db, "staff")((q) => q.query("select public.set_order_status($1, 'in_chat')", [o.id]));
    expect(await purchaseEvents(o.id)).toBe(0);
  });
});

describe("Pay on Delivery agreed in chat", () => {
  it("dispatcher records the cash collected at delivery; order becomes paid and stock is deducted", async () => {
    const o = await createOrder(db, { phone: "+2348031110000" });
    const hubCode = (await db.query<{ code: string }>(
      "select h.code from public.orders o join public.hubs h on h.id = o.hub_id where o.id = $1",
      [o.id],
    ))[0]!.code;
    const start = await inventory(db, VACUUM, hubCode);
    const staff = as(db, "staff");
    const flag = await staff((q) =>
      q.query<{ r: Record<string, unknown> }>("select public.set_payment_agreement($1, 'pay_on_delivery', 'Agreed POD on WhatsApp') as r", [o.id]),
    );
    expect(flag[0]!.r).toMatchObject({ payment_status: "pay_on_delivery", pod_agreed: true });
    await staff((q) => q.query("select public.set_order_status($1, 'confirmed')", [o.id]));
    await staff((q) => q.query("select public.assign_dispatcher($1, $2)", [o.id, ids.user("dispatcher")]));
    const done = await as(db, "dispatcher")((q) =>
      q.query<{ r: Record<string, unknown> }>("select public.complete_delivery($1, 3750000, 'pay_on_delivery', null, 'Cash collected') as r", [o.id]),
    );
    expect(done[0]!.r).toMatchObject({ status: "delivered", payment_status: "paid", amount_paid_kobo: 3_750_000 });
    const pay = await db.query<{ recorded_by_role: string; method: string }>(
      "select recorded_by_role, method from public.payments where order_id = $1",
      [o.id],
    );
    expect(pay).toEqual([{ recorded_by_role: "dispatcher", method: "pay_on_delivery" }]);
    const end = await inventory(db, VACUUM, hubCode);
    expect(start.on_hand - end.on_hand).toBe(2);
    expect(start.reserved - end.reserved).toBe(2);
    const audit = await db.query<{ action: string }>(
      "select action from public.audit_log where entity_id = $1 order by id",
      [o.id],
    );
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(["order.payment_flag", "order.assign", "payment.collect_on_delivery", "order.delivered"]),
    );
  });
});
