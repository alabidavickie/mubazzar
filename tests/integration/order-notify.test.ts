import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types-core";
import { createOrder } from "./helpers";

// Customer status-update SMS go through the notify adapter (mock → notifications_outbox without keys).
process.env.PGLITE_DATA_DIR = "memory";
delete process.env.DATABASE_URL;
delete process.env.TERMII_API_KEY;

let db: Db;
let svc: typeof import("@/server/services/order-notify");

beforeAll(async () => {
  db = await (await import("@/server/db")).getDb();
  svc = await import("@/server/services/order-notify");
});
afterAll(async () => {
  await db.close();
});

describe("notifyCustomerOfStatus", () => {
  it("texts the customer on milestones and stays silent otherwise", async () => {
    const order = await createOrder(db, { phone: "+2348037770001" });
    await svc.notifyCustomerOfStatus(order.id, "confirmed");
    await svc.notifyCustomerOfStatus(order.id, "in_chat");
    await svc.notifyCustomerOfStatus(order.id, "failed_delivery", "Customer not reachable");
    const rows = await db.query<{ template: string; recipient: string; body: string; status: string }>(
      "select template, recipient, body, status from public.notifications_outbox where order_id = $1 order by created_at",
      [order.id],
    );
    expect(rows.map((r) => r.template)).toEqual(["customer_status_confirmed", "customer_status_failed_delivery"]);
    expect(rows.every((r) => r.recipient === "+2348037770001" && r.status === "mocked")).toBe(true);
    expect(rows[0]!.body).toContain(order.order_number);
    expect(rows[1]!.body).toContain("Customer not reachable");
  });

  it("never throws for unknown orders", async () => {
    await expect(svc.notifyCustomerOfStatus("00000000-0000-4000-8000-000000000000", "confirmed")).resolves.toBeUndefined();
  });
});
