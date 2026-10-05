import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types-core";
import { as, freshDb, rejects } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});
afterAll(async () => {
  await db.close();
});

/** security-definer functions intentionally exposed to signed-in users (each checks roles inside). */
const AUTHENTICATED_ALLOWED = new Set([
  "current_app_role",
  "is_admin",
  "is_staff",
  "effective_unit_price",
  "effective_bundle_price",
  "quote_delivery",
  "track_order",
  "set_order_status",
  "add_order_note",
  "set_payment_agreement",
  "record_payment",
  "assign_dispatcher",
  "complete_delivery",
  "fail_delivery",
  "submit_review",
  "review_supplier",
  "review_supplier_product",
  "adjust_inventory",
  "admin_audit",
]);
const ANON_ALLOWED = new Set(["current_app_role", "is_admin", "is_staff", "effective_unit_price", "effective_bundle_price", "quote_delivery", "track_order"]);

describe("function privileges", () => {
  it("no security-definer function is executable by anon/authenticated unless allow-listed", async () => {
    const rows = await db.query<{ name: string; anon: boolean; auth: boolean }>(
      `select p.proname as name,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as auth
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef`,
    );
    const leakedToAnon = rows.filter((r) => r.anon && !ANON_ALLOWED.has(r.name)).map((r) => r.name);
    const leakedToAuth = rows.filter((r) => r.auth && !AUTHENTICATED_ALLOWED.has(r.name)).map((r) => r.name);
    expect(leakedToAnon).toEqual([]);
    expect(leakedToAuth).toEqual([]);
  });

  it("guests and customers cannot call internal or service-only functions", async () => {
    for (const who of ["anon", "customer", "staff"] as const) {
      await rejects(as(db, who)((q) => q.query("select public.create_order('{}'::jsonb)")), /permission denied/);
      await rejects(
        as(db, who)((q) => q.query("select public._apply_status(gen_random_uuid(), 'cancelled', 'x')")),
        /permission denied/,
      );
      await rejects(as(db, who)((q) => q.query("select public.cancel_stale_orders()")), /permission denied/);
      await rejects(as(db, who)((q) => q.query("select public.claim_payment('x')")), /permission denied/);
    }
  });
});
