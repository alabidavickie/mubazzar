import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types-core";
import { as, ids, VACUUM } from "./helpers";

// Server cart fallback (signed-in customers): saved as the user under RLS, re-priced from the DB.
process.env.PGLITE_DATA_DIR = "memory";
delete process.env.DATABASE_URL;

let db: Db;
let cart: typeof import("@/server/services/cart");

beforeAll(async () => {
  const dbMod = await import("@/server/db");
  db = await dbMod.getDb();
  cart = await import("@/server/services/cart");
});
afterAll(async () => {
  await db.close();
});

const customer = ids.user("customer");

describe("server cart", () => {
  it("saves and loads the customer's cart (upsert, one row per user)", async () => {
    expect(await cart.loadServerCart(customer)).toEqual([]);
    await cart.saveServerCart(customer, [{ productId: ids.product(VACUUM), bundleId: null, packs: 2 }]);
    await cart.saveServerCart(customer, [{ productId: ids.product(VACUUM), bundleId: ids.bundle(VACUUM, "2x"), packs: 1 }]);
    expect(await cart.loadServerCart(customer)).toEqual([{ productId: ids.product(VACUUM), bundleId: ids.bundle(VACUUM, "2x"), packs: 1 }]);
    const rows = await db.query<{ n: number }>("select count(*)::int as n from public.carts where user_id = $1", [customer]);
    expect(rows[0]!.n).toBe(1);
  });

  it("is private to its owner under RLS", async () => {
    const asStaff = await as(db, "staff")((q) => q.query("select * from public.carts"));
    expect(asStaff).toEqual([]);
    const asAnon = await as(db, "anon")((q) => q.query("select * from public.carts"));
    expect(asAnon).toEqual([]);
    await expect(
      as(db, "staff")((q) => q.query("insert into public.carts (user_id, items) values ($1, '[]'::jsonb)", [customer])),
    ).rejects.toThrow();
  });

  it("re-prices lines from the database and drops lines that are no longer on sale", async () => {
    const lines = await cart.priceCartItems([
      { productId: ids.product(VACUUM), bundleId: ids.bundle(VACUUM, "2x"), packs: 1 },
      { productId: ids.product(VACUUM), bundleId: null, packs: 3 },
      { productId: ids.product(VACUUM), bundleId: "00000000-0000-4000-8000-000000000000", packs: 1 },
      { productId: "00000000-0000-4000-8000-000000000001", bundleId: null, packs: 1 },
    ]);
    expect(lines).toHaveLength(2);
    const [bundleLine, plain] = lines;
    const live = await db.query<{ price: string }>("select public.effective_bundle_price($1)::text as price", [ids.bundle(VACUUM, "2x")]);
    expect(bundleLine).toMatchObject({ slug: VACUUM, packs: 1, unitPriceKobo: Number(live[0]!.price) });
    expect(bundleLine!.bundleLabel).toBeTruthy();
    const unit = await db.query<{ price: string }>("select public.effective_unit_price($1)::text as price", [ids.product(VACUUM)]);
    expect(plain).toMatchObject({ bundleId: null, packs: 3, unitPriceKobo: Number(unit[0]!.price) });

    await db.query("update public.bundles set is_active = false where id = $1", [ids.bundle(VACUUM, "2x")]);
    expect(await cart.priceCartItems([{ productId: ids.product(VACUUM), bundleId: ids.bundle(VACUUM, "2x"), packs: 1 }])).toEqual([]);
    await db.query("update public.bundles set is_active = true where id = $1", [ids.bundle(VACUUM, "2x")]);
  });
});
