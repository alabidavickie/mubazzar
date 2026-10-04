/**
 * Pure cart helpers shared by the client store and the server cart mirror. Items carry only
 * identity + pack count; names and prices are always re-read from the database.
 */
export const MAX_CART_LINES = 20;
export const MAX_PACKS = 20;

export interface CartItemRef {
  productId: string;
  bundleId: string | null;
  packs: number;
}

export const cartKey = (i: { productId: string; bundleId: string | null }) => `${i.productId}:${i.bundleId ?? ""}`;

/**
 * Merges the device cart with the account's saved cart when a customer signs in: every line from
 * both, the larger pack count when a line is in both (never doubling), device order first, capped.
 */
export function mergeCartItems(local: CartItemRef[], saved: CartItemRef[]): CartItemRef[] {
  const out = new Map<string, CartItemRef>();
  for (const item of [...local, ...saved]) {
    const packs = Math.min(MAX_PACKS, Math.max(1, Math.floor(item.packs)));
    const key = cartKey(item);
    const prev = out.get(key);
    if (prev) prev.packs = Math.max(prev.packs, packs);
    else out.set(key, { productId: item.productId, bundleId: item.bundleId ?? null, packs });
  }
  return [...out.values()].slice(0, MAX_CART_LINES);
}
