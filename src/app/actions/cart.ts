"use server";

import { cartSyncSchema, type CartSyncInput } from "@/lib/schemas/cart";
import { mergeCartItems } from "@/lib/cart";
import type { CartLine } from "@/lib/client/cart-store";
import { rateLimit } from "@/server/adapters/rate-limit";
import { loadServerCart, priceCartItems, saveServerCart } from "@/server/services/cart";
import { getSession } from "@/server/session";

export type CartSyncResult =
  | { ok: true; lines?: CartLine[] }
  | { ok: false; reason: "signed_out" | "invalid" | "rate_limited" };

/**
 * Mirrors the device cart to the signed-in customer's account (server cart fallback). With
 * `merge` (first sync after sign-in) the saved cart is merged in and re-priced lines come back.
 */
export async function syncCartAction(input: CartSyncInput): Promise<CartSyncResult> {
  const session = await getSession();
  if (!session || session.role !== "customer") return { ok: false, reason: "signed_out" };
  const parsed = cartSyncSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!(await rateLimit(`cart:${session.userId}`, 120, 600)).ok) return { ok: false, reason: "rate_limited" };

  const { items, merge } = parsed.data;
  if (!merge) {
    await saveServerCart(session.userId, items);
    return { ok: true };
  }
  const merged = mergeCartItems(items, await loadServerCart(session.userId));
  const lines = await priceCartItems(merged);
  await saveServerCart(
    session.userId,
    lines.map((l) => ({ productId: l.productId, bundleId: l.bundleId, packs: l.packs })),
  );
  return { ok: true, lines };
}
