import { openLocalDb, runAs } from "@/server/db/core";
import { seedId } from "@/server/db/seed/ids";
import type { Db, Queryable } from "@/server/db/types-core";
import { generateOrderNumber } from "@/lib/order-number";

export type Role = "admin" | "staff" | "dispatcher" | "customer";

export const ids = {
  user: (role: Role) => seedId("user", role),
  product: (slug: string) => seedId("product", slug),
  bundle: (slug: string, key: string) => seedId("bundle", `${slug}:${key}`),
  hub: (code: string) => seedId("hub", code),
  lp: (slug: string) => seedId("lp", slug),
};

export const VACUUM = "turbo-car-vacuum";

export async function freshDb(): Promise<Db> {
  return openLocalDb("memory");
}

export function as(db: Db, who: Role | "anon" | "service") {
  return <T>(fn: (q: Queryable) => Promise<T>) =>
    runAs(db, who === "service" ? { kind: "service" } : who === "anon" ? { kind: "anon" } : { kind: "user", userId: ids.user(who) }, fn);
}

export interface CreateOrderInput {
  state?: string;
  items?: { product_id: string; bundle_id?: string | null; packs: number }[];
  phone?: string;
  extra?: Record<string, unknown>;
}

/** Calls create_order as trusted server code (the only path allowed to create orders). */
export async function createOrder(db: Db, input: CreateOrderInput = {}) {
  const payload = {
    order_number: generateOrderNumber(),
    idempotency_key: crypto.randomUUID(),
    source: "landing_page",
    customer_name: "Test Buyer",
    phone_e164: input.phone ?? "+2348031234567",
    state: input.state ?? "Lagos",
    city: "Ikeja",
    address: "12 Allen Avenue, Ikeja",
    chat_channel: "whatsapp",
    items: input.items ?? [{ product_id: ids.product(VACUUM), bundle_id: ids.bundle(VACUUM, "2x"), packs: 1 }],
    ...input.extra,
  };
  const rows = await db.query<{ r: { id: string; order_number: string; public_token: string; total_kobo: number; existing: boolean } }>(
    "select public.create_order($1::jsonb) as r",
    [payload],
  );
  return rows[0]!.r;
}

export async function inventory(db: Db, slug: string, hub: string) {
  const rows = await db.query<{ on_hand: number; reserved: number }>(
    "select on_hand, reserved from public.inventory where product_id = $1 and hub_id = $2",
    [ids.product(slug), ids.hub(hub)],
  );
  return rows[0]!;
}

export async function order(db: Db, id: string) {
  const rows = await db.query<Record<string, unknown> & { status: string; payment_status: string; total_kobo: number; amount_paid_kobo: number; is_overpaid: boolean; hub_id: string }>(
    "select * from public.orders where id = $1",
    [id],
  );
  return rows[0]!;
}

/** Expect a promise to reject with a message matching `re`. */
export async function rejects(p: Promise<unknown>, re: RegExp): Promise<void> {
  try {
    await p;
  } catch (e) {
    const msg = (e as Error).message;
    if (!re.test(msg)) throw new Error(`Expected error matching ${re}, got: ${msg}`);
    return;
  }
  throw new Error(`Expected rejection matching ${re}, but it resolved`);
}
