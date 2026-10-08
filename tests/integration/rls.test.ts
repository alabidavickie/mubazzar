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

describe("only the admin uploads products", () => {
  const NEW_PRODUCT = `insert into public.products (slug, name, price_kobo) values ('sneaky-product', 'Sneaky Product', 100000) returning id`;

  it.each(["anon", "customer", "staff", "dispatcher"] as const)("%s cannot create, edit, hide or delete products", async (who) => {
    await rejects(as(db, who)((q) => q.query(NEW_PRODUCT)), /row-level security|permission denied/);
    const touched = async (sql: string) => (await as(db, who)((q) => q.query(sql))).length;
    expect(await touched(`update public.products set price_kobo = 1 where slug = '${VACUUM}' returning 1`)).toBe(0);
    expect(await touched(`update public.products set is_active = false where slug = '${VACUUM}' returning 1`)).toBe(0);
    expect(await touched(`delete from public.products where slug = '${VACUUM}' returning 1`)).toBe(0);
    expect(await touched(`update public.bundles set price_kobo = 1 returning 1`)).toBe(0);
    expect(await touched(`update public.free_gifts set is_active = false returning 1`)).toBe(0);
    expect(await touched(`update public.product_images set alt = 'x' returning 1`)).toBe(0);
  });

  it("the admin can", async () => {
    const rows = await as(db, "admin")((q) => q.query<{ id: string }>(NEW_PRODUCT));
    expect(rows).toHaveLength(1);
    await as(db, "admin")((q) => q.query("delete from public.products where id = $1", [rows[0]!.id]));
  });

  it("there are no supplier/reseller tables, functions or accounts", async () => {
    const [t] = await db.query<{ a: string | null; b: string | null }>(
      "select to_regclass('public.suppliers')::text as a, to_regclass('public.supplier_products')::text as b",
    );
    expect(t).toEqual({ a: null, b: null });
    const fns = await db.query<{ proname: string }>("select proname from pg_proc where proname like '%supplier%'");
    expect(fns).toEqual([]);
    const cols = await db.query("select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'supplier_id'");
    expect(cols).toEqual([]);
  });

  it("no account can ever be given the retired supplier role, not even by an admin", async () => {
    await rejects(
      as(db, "admin")((q) => q.query(`update public.profiles set role = 'supplier' where id = $1`, [ids.user("customer")])),
      /profiles_no_supplier_role/,
    );
    await rejects(db.query(`update public.profiles set role = 'supplier' where id = $1`, [ids.user("customer")]), /profiles_no_supplier_role/);
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
