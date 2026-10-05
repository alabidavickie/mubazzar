import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types-core";
import { createOrder, ids } from "./helpers";

// Guest orders attach to an account only through the phone verified on auth.users.
process.env.PGLITE_DATA_DIR = "memory";
delete process.env.DATABASE_URL;

let db: Db;
let account: typeof import("@/server/services/account");

beforeAll(async () => {
  db = await (await import("@/server/db")).getDb();
  account = await import("@/server/services/account");
});
afterAll(async () => {
  await db.close();
});

const session = (userId: string) => ({ userId, email: null, role: "customer" as const, fullName: null, phone: null });

describe("linkGuestOrders", () => {
  it("links guest orders placed with the customer's verified phone, never other people's", async () => {
    const [u] = await db.query<{ phone: string | null }>("select phone from auth.users where id = $1", [ids.user("customer")]);
    const phone = `+${(u!.phone ?? "").replace(/^\+/, "")}`;
    const mine = await createOrder(db, { phone });
    const other = await createOrder(db, { phone: "+2348039998877" });
    expect(await account.linkGuestOrders(session(ids.user("customer")))).toBeGreaterThanOrEqual(1);
    const rows = await db.query<{ id: string; user_id: string | null }>("select id, user_id from public.orders where id = any($1::uuid[])", [[mine.id, other.id]]);
    expect(rows.find((r) => r.id === mine.id)!.user_id).toBe(ids.user("customer"));
    expect(rows.find((r) => r.id === other.id)!.user_id).toBeNull();
  });

  it("does nothing for email-only accounts", async () => {
    const [u] = await db.query<{ id: string }>("insert into auth.users (email) values ('emailonly@example.ng') returning id");
    await createOrder(db, { phone: "+2348039998878" });
    expect(await account.linkGuestOrders(session(u!.id))).toBe(0);
  });
});
