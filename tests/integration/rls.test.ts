import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types-core";
import { as, createOrder, freshDb, ids, rejects, VACUUM } from "./helpers";

let db: Db;
let customerOrderId: string;
let guestOrderId: string;
let assignedOrderId: string;

beforeAll(async () => {
  db = await freshDb();
  customerOrderId = (await createOrder(db, { extra: { user_id: ids.user("customer") } })).id;
  guestOrderId = (await createOrder(db, { phone: "+2348099990000" })).id;
  assignedOrderId = (await createOrder(db, { phone: "+2348099990001" })).id;
  await as(db, "staff")((q) => q.query("select public.set_order_status($1, 'confirmed')", [assignedOrderId]));
  await as(db, "staff")((q) => q.query("select public.assign_dispatcher($1, $2)", [assignedOrderId, ids.user("dispatcher")]));
});
afterAll(async () => {
  await db.close();
});

const count = async (who: Parameters<typeof as>[1], sql: string, params: unknown[] = []) =>
  (await as(db, who)((q) => q.query<{ n: number }>(`select count(*)::int as n from (${sql}) t`, params as never[])))[0]!.n;

describe("RLS is enabled on every public table", () => {
  it("has no unprotected tables", async () => {
    const rows = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });
});

describe("guest (anon)", () => {
  it("reads the public catalogue but not private data", async () => {
    expect(await count("anon", "select 1 from public.products")).toBeGreaterThan(30);
    expect(await count("anon", "select 1 from public.landing_pages")).toBe(1);
    expect(await count("anon", "select 1 from public.orders")).toBe(0);
    expect(await count("anon", "select 1 from public.payments")).toBe(0);
    expect(await count("anon", "select 1 from public.profiles")).toBe(0);
    expect(await count("anon", "select 1 from public.audit_log")).toBe(0);
    expect(await count("anon", "select 1 from public.suppliers")).toBe(0);
  });

  it("never sees bank details or disabled chat channels", async () => {
    expect(await count("anon", "select 1 from public.settings where key = 'bank_accounts'")).toBe(0);
    expect(await count("anon", "select 1 from public.settings where key = 'hero'")).toBe(1);
    expect(await count("anon", "select 1 from public.chat_channels where not is_enabled")).toBe(0);
    expect(await count("anon", "select 1 from public.chat_channels where kind = 'instagram'")).toBe(1);
  });

  it("cannot create orders directly or call service-only functions", async () => {
    await rejects(
      as(db, "anon")((q) => q.query("insert into public.orders (order_number) values ('MBZ-AAAAAA')")),
      /row-level security|permission denied|violates/,
    );
    await rejects(as(db, "anon")((q) => q.query("select public.create_order('{}'::jsonb)")), /permission denied/);
    await rejects(as(db, "anon")((q) => q.query("select public.cancel_stale_orders()")), /permission denied/);
  });

  it("cannot change products", async () => {
    const rows = await as(db, "anon")((q) =>
      q.query("update public.products set price_kobo = 100 where slug = $1 returning id", [VACUUM]),
    );
    expect(rows).toHaveLength(0);
  });

  it("can track an order only with the matching phone", async () => {
    const [{ number }] = await db.query<{ number: string }>("select order_number as number from public.orders where id = $1", [guestOrderId]);
    const ok = await as(db, "anon")((q) => q.query<{ r: unknown }>("select public.track_order($1, $2) as r", [number, "+2348099990000"]));
    expect(ok[0]!.r).toMatchObject({ order_number: number, status: "awaiting_chat" });
    const bad = await as(db, "anon")((q) => q.query<{ r: unknown }>("select public.track_order($1, $2) as r", [number, "+2348000000000"]));
    expect(bad[0]!.r).toBeNull();
  });
});

describe("customer", () => {
  it("sees only their own orders and profile", async () => {
    expect(await count("customer", "select 1 from public.orders")).toBe(1);
    expect(await count("customer", "select 1 from public.orders where id = $1", [guestOrderId])).toBe(0);
    expect(await count("customer", "select 1 from public.profiles")).toBe(1);
  });

  it("cannot record payments, change status, or promote themselves", async () => {
    await rejects(
      as(db, "customer")((q) => q.query("select public.record_payment($1, 100000, 'bank_transfer')", [customerOrderId])),
      /FORBIDDEN/,
    );
    await rejects(
      as(db, "customer")((q) => q.query("select public.set_order_status($1, 'cancelled')", [customerOrderId])),
      /FORBIDDEN/,
    );
    await rejects(
      as(db, "customer")((q) => q.query("update public.profiles set role = 'admin' where id = $1", [ids.user("customer")])),
      /FORBIDDEN_ROLE_CHANGE/,
    );
    await rejects(
      as(db, "customer")((q) =>
        q.query(
          "insert into public.payments (order_id, amount_kobo, method, recorded_by, recorded_by_role) values ($1, 100, 'other', $2, 'customer')",
          [customerOrderId, ids.user("customer")],
        ),
      ),
      /row-level security/,
    );
    const updated = await as(db, "customer")((q) =>
      q.query("update public.orders set total_kobo = 1 where id = $1 returning id", [customerOrderId]),
    );
    expect(updated).toHaveLength(0);
  });

  it("can only review delivered verified purchases", async () => {
    await rejects(
      as(db, "customer")((q) =>
        q.query("select public.submit_review($1, $2, 5, 'Great product, works well')", [customerOrderId, ids.product(VACUUM)]),
      ),
      /NOT_A_VERIFIED_PURCHASE/,
    );
  });
});

describe("order staff", () => {
  it("sees all orders and private settings but cannot edit catalogue or settings", async () => {
    expect(await count("staff", "select 1 from public.orders")).toBeGreaterThanOrEqual(3);
    expect(await count("staff", "select 1 from public.settings where key = 'bank_accounts'")).toBe(1);
    const p = await as(db, "staff")((q) => q.query("update public.products set price_kobo = 100 where slug = $1 returning id", [VACUUM]));
    expect(p).toHaveLength(0);
    const s = await as(db, "staff")((q) => q.query("update public.settings set value = '\"x\"' where key = 'promo_strip' returning key"));
    expect(s).toHaveLength(0);
    await rejects(
      as(db, "staff")((q) => q.query("select public.adjust_inventory($1, $2, 999)", [ids.product(VACUUM), ids.hub("lagos")])),
      /FORBIDDEN/,
    );
  });

  it("cannot change money or status fields directly (must use audited functions)", async () => {
    await rejects(
      as(db, "staff")((q) => q.query("update public.orders set total_kobo = 1 where id = $1", [guestOrderId])),
      /USE_ORDER_FUNCTIONS/,
    );
    await rejects(
      as(db, "staff")((q) => q.query("update public.orders set payment_status = 'paid' where id = $1", [guestOrderId])),
      /USE_ORDER_FUNCTIONS/,
    );
    const ok = await as(db, "staff")((q) =>
      q.query("update public.orders set landmark = 'Opposite Shoprite' where id = $1 returning id", [guestOrderId]),
    );
    expect(ok).toHaveLength(1);
  });

  it("cannot read the audit log (admin only)", async () => {
    expect(await count("staff", "select 1 from public.audit_log")).toBe(0);
  });
});

describe("dispatcher", () => {
  it("sees only orders assigned to them", async () => {
    expect(await count("dispatcher", "select 1 from public.orders")).toBe(1);
    expect(await count("dispatcher", "select 1 from public.orders where id = $1", [assignedOrderId])).toBe(1);
    expect(await count("dispatcher", "select 1 from public.payments")).toBe(0);
  });

  it("cannot record payments outside a delivery, nor complete unassigned deliveries", async () => {
    await rejects(
      as(db, "dispatcher")((q) => q.query("select public.record_payment($1, 100000, 'pay_on_delivery')", [assignedOrderId])),
      /FORBIDDEN/,
    );
    await rejects(
      as(db, "dispatcher")((q) => q.query("select public.complete_delivery($1, 0)", [guestOrderId])),
      /FORBIDDEN/,
    );
  });
});

describe("supplier", () => {
  it("manages only their own submissions and sees no orders", async () => {
    expect(await count("supplier", "select 1 from public.orders")).toBe(0);
    const rows = await as(db, "supplier")((q) =>
      q.query<{ id: string }>(
        `insert into public.supplier_products (supplier_id, name, description, proposed_price_kobo, status)
         values ($1, 'Mini Sealer', 'Seals snack bags with heat', 500000, 'pending') returning id`,
        [ids.supplier()],
      ),
    );
    expect(rows).toHaveLength(1);
    await rejects(
      as(db, "supplier")((q) =>
        q.query(
          `insert into public.supplier_products (supplier_id, name, description, proposed_price_kobo, status)
           values ($1, 'Sneaky', 'Self-approved product', 500000, 'approved')`,
          [ids.supplier()],
        ),
      ),
      /row-level security/,
    );
    await rejects(
      as(db, "supplier")((q) => q.query("select public.review_supplier_product($1, true)", [rows[0]!.id])),
      /FORBIDDEN/,
    );
  });
});

describe("admin", () => {
  it("can edit the catalogue and read the audit log", async () => {
    const p = await as(db, "admin")((q) =>
      q.query("update public.products set seo_title = 'Updated' where slug = $1 returning id", [VACUUM]),
    );
    expect(p).toHaveLength(1);
    expect(await count("admin", "select 1 from public.audit_log")).toBeGreaterThan(0);
  });
});
