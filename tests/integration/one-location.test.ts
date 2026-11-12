import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types-core";
import { createOrder, freshDb, ids, order, VACUUM } from "./helpers";

// supabase/maintenance/one-location.sql is run by the owner on the live database: prove it is
// valid SQL, loses no stock, is safe to re-run and leaves ordering working from the one location.
const sql = readFileSync("supabase/maintenance/one-location.sql", "utf8");

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});
afterAll(async () => {
  await db.close();
});

async function totals() {
  const rows = await db.query<{ on_hand: number; reserved: number }>(
    "select coalesce(sum(on_hand), 0)::int as on_hand, coalesce(sum(reserved), 0)::int as reserved from public.inventory where product_id = $1",
    [ids.product(VACUUM)],
  );
  return rows[0]!;
}

describe("one-location maintenance script", () => {
  it("moves stock and open orders to the single store and switches the other hubs off", async () => {
    const open = await createOrder(db); // reserves 2 units in the Lagos hub
    const before = await totals();

    await db.exec(sql);
    await db.exec(sql); // re-run: nothing changes

    expect(await totals()).toEqual(before);
    const hubs = await db.query<{ code: string; name: string }>("select code, name from public.hubs where is_active");
    expect(hubs).toEqual([{ code: "warehouse", name: "Ibadan store" }]);
    const stray = await db.query("select 1 from public.inventory where hub_id <> $1", [ids.hub("warehouse")]);
    expect(stray).toHaveLength(0);
    expect((await order(db, open.id)).hub_id).toBe(ids.hub("warehouse"));
    const zones = await db.query("select 1 from public.delivery_zones where hub_code <> 'warehouse'");
    expect(zones).toHaveLength(0);
  });

  it("still takes a new order, fulfilled from the single store", async () => {
    const o = await createOrder(db, { state: "Oyo" });
    expect((await order(db, o.id)).hub_id).toBe(ids.hub("warehouse"));
  });
});
