import { beforeAll, describe, expect, it } from "vitest";
import { seedId } from "@/server/db/seed/ids";
import type { RequestContext } from "@/server/services/orders";

// The service uses the process-wide DB: point it at a fresh in-memory, seeded database.
process.env.PGLITE_DATA_DIR = "memory";

type Svc = typeof import("@/server/services/orders");
type DbMod = typeof import("@/server/db");
let svc: Svc;
let db: DbMod;

const VACUUM = seedId("product", "turbo-car-vacuum");
const BUNDLE_2X = seedId("bundle", "turbo-car-vacuum:2x");
let n = 0;
const phone = () => `0815${String(Date.now() % 1_000_000).padStart(6, "0").slice(0, 3)}${String(++n).padStart(4, "0")}`;
const ctx = (): RequestContext => ({ ip: `10.0.${n}.${Math.floor(Math.random() * 250)}`, userAgent: "vitest" });

function base(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Ada Lovelace",
    phone: phone(),
    altPhone: "",
    state: "Lagos",
    city: "Ikeja",
    address: "12 Allen Avenue, Ikeja",
    landmark: "",
    chatChannel: "whatsapp",
    items: [{ productId: VACUUM, bundleId: BUNDLE_2X, packs: 1 }],
    source: "landing_page",
    idempotencyKey: crypto.randomUUID(),
    ...overrides,
  };
}

beforeAll(async () => {
  svc = await import("@/server/services/orders");
  db = await import("@/server/db");
});

describe("placeOrder (service-level abuse cases)", () => {
  it("places a valid order with a server-computed total", async () => {
    const r = await svc.placeOrder(base(), ctx());
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.totalKobo).toBeGreaterThan(0);
  });

  it("ignores client-sent price fields entirely", async () => {
    const honest = await svc.placeOrder(base(), ctx());
    const tampered = await svc.placeOrder(
      base({
        items: [{ productId: VACUUM, bundleId: BUNDLE_2X, packs: 1, priceKobo: 100, unitPriceKobo: 100 }],
        totalKobo: 100,
        subtotalKobo: 100,
        deliveryFeeKobo: 0,
      }),
      ctx(),
    );
    expect(honest.ok && tampered.ok).toBe(true);
    if (honest.ok && tampered.ok) expect(tampered.totalKobo).toBe(honest.totalKobo);
  });

  it.each([
    ["zero packs", { packs: 0 }],
    ["too many packs", { packs: 21 }],
    ["fractional packs", { packs: 1.5 }],
    ["negative packs", { packs: -3 }],
    ["non-uuid product", { productId: "1 or 1=1" }],
  ])("rejects %s", async (_label, item) => {
    const r = await svc.placeOrder(base({ items: [{ productId: VACUUM, bundleId: null, packs: 1, ...item }] }), ctx());
    expect(r.ok).toBe(false);
  });

  it("rejects empty and oversized carts", async () => {
    expect((await svc.placeOrder(base({ items: [] }), ctx())).ok).toBe(false);
    const many = Array.from({ length: 21 }, () => ({ productId: VACUUM, bundleId: null, packs: 1 }));
    expect((await svc.placeOrder(base({ items: many }), ctx())).ok).toBe(false);
  });

  it("rejects a bundle that belongs to another product and unknown products", async () => {
    const other = seedId("product", "electric-veggie-chopper");
    const wrongBundle = await svc.placeOrder(base({ items: [{ productId: other, bundleId: BUNDLE_2X, packs: 1 }] }), ctx());
    expect(wrongBundle).toMatchObject({ ok: false, code: "BUNDLE_UNAVAILABLE" });
    const unknown = await svc.placeOrder(base({ items: [{ productId: crypto.randomUUID(), bundleId: null, packs: 1 }] }), ctx());
    expect(unknown).toMatchObject({ ok: false, code: "PRODUCT_UNAVAILABLE" });
  });

  it("refuses inactive products", async () => {
    const slugId = seedId("product", "glass-oil-sprayer");
    await db.asService((q) => q.query("update public.products set is_active = false where id = $1", [slugId]));
    const r = await svc.placeOrder(base({ items: [{ productId: slugId, bundleId: null, packs: 1 }] }), ctx());
    expect(r).toMatchObject({ ok: false, code: "PRODUCT_UNAVAILABLE" });
  });

  it("rejects invalid states, phones and the honeypot", async () => {
    expect((await svc.placeOrder(base({ state: "Atlantis" }), ctx())).ok).toBe(false);
    expect((await svc.placeOrder(base({ phone: "12345" }), ctx())).ok).toBe(false);
    expect(await svc.placeOrder(base({ website: "http://spam" }), ctx())).toMatchObject({ ok: false, code: "REJECTED" });
  });

  it("never routes to a disabled channel", async () => {
    const r = await svc.placeOrder(base({ chatChannel: "telegram" }), ctx()); // Telegram is disabled in the seed
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rows = await db.asService((q) =>
      q.query<{ chat_channel: string }>("select chat_channel from public.orders where public_token = $1", [r.publicToken]),
    );
    expect(rows[0]!.chat_channel).toBe("whatsapp");
  });

  it("flags a repeat order from the same phone within 24h", async () => {
    const p = phone();
    const first = await svc.placeOrder(base({ phone: p }), ctx());
    const second = await svc.placeOrder(base({ phone: p }), ctx());
    expect(first.ok && second.ok).toBe(true);
    if (!second.ok) return;
    const rows = await db.asService((q) =>
      q.query<{ is_duplicate_suspect: boolean }>("select is_duplicate_suspect from public.orders where public_token = $1", [second.publicToken]),
    );
    expect(rows[0]!.is_duplicate_suspect).toBe(true);
  });

  const cancelOpen = (where: string, param: string) =>
    db.asService((q) =>
      q.query(`update public.orders set status = 'cancelled' where ${where} = $1 and status = 'awaiting_chat'`, [param]),
    );

  it("caps one phone at 3 unpaid open orders, then rate-limits it after 5 orders an hour (any IP)", async () => {
    const p = phone();
    const first = [];
    for (let i = 0; i < 4; i++) first.push(await svc.placeOrder(base({ phone: p }), ctx()));
    expect(first.slice(0, 3).every((r) => r.ok)).toBe(true);
    expect(first[3]).toMatchObject({ ok: false, code: "TOO_MANY_OPEN_ORDERS" });
    // Once those are settled (here: cancelled), the hourly rate limit still applies.
    const { normalizeNgPhone } = await import("@/lib/phone");
    const e164 = normalizeNgPhone(p);
    await cancelOpen("phone_e164", e164.ok ? e164.e164 : p);
    const more = [];
    for (let i = 0; i < 3; i++) more.push(await svc.placeOrder(base({ phone: p }), ctx()));
    expect(more.slice(0, 1).every((r) => r.ok)).toBe(true);
    expect(more.some((r) => !r.ok && r.code === "RATE_LIMITED")).toBe(true);
  });

  it("caps one IP at 8 unpaid open orders, then rate-limits it after 10 orders in 10 minutes", async () => {
    const fixed: RequestContext = { ip: "203.0.113.77", userAgent: "vitest" };
    const results = [];
    for (let i = 0; i < 9; i++) results.push(await svc.placeOrder(base(), fixed));
    expect(results.slice(0, 8).every((r) => r.ok)).toBe(true);
    expect(results[8]).toMatchObject({ ok: false, code: "TOO_MANY_OPEN_ORDERS" });
    const { hashIp } = await import("@/server/adapters/rate-limit");
    await cancelOpen("client_ip_hash", hashIp("203.0.113.77"));
    const more = [];
    for (let i = 0; i < 3; i++) more.push(await svc.placeOrder(base(), fixed));
    expect(more.some((r) => !r.ok && r.code === "RATE_LIMITED")).toBe(true);
  });

  it("refuses more than 10 units of one product in a single order, in plain words", async () => {
    const r = await svc.placeOrder(
      base({ items: [{ productId: VACUUM, bundleId: seedId("bundle", "turbo-car-vacuum:3x"), packs: 4 }] }),
      ctx(),
    );
    expect(r).toMatchObject({ ok: false, code: "TOO_MANY_UNITS" });
    if (!r.ok) expect(r.error).toMatch(/bulk|WhatsApp/i);
  });

  it("explains out-of-stock in plain words and reserves nothing", async () => {
    const pid = seedId("product", "portable-power-station-300w");
    await db.asService((q) => q.query("update public.inventory set on_hand = 1, reserved = 0 where product_id = $1", [pid]));
    const r = await svc.placeOrder(base({ items: [{ productId: pid, bundleId: null, packs: 5 }] }), ctx());
    expect(r).toMatchObject({ ok: false, code: "OUT_OF_STOCK" });
    if (!r.ok) expect(r.error).toMatch(/sold out/i);
    const inv = await db.asService((q) =>
      q.query<{ reserved: number }>("select sum(reserved)::int as reserved from public.inventory where product_id = $1", [pid]),
    );
    expect(inv[0]!.reserved).toBe(0);
  });

  it("replaying the same idempotency key returns the same order instead of a second one", async () => {
    const payload = base();
    const a = await svc.placeOrder(payload, ctx());
    const b = await svc.placeOrder(payload, ctx());
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(b.orderNumber).toBe(a.orderNumber);
      expect(b.existing).toBe(true);
    }
  });
});
