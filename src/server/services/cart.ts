import "server-only";
import { asUser } from "../db";
import { getProductById } from "./catalog";
import type { CartItemRef } from "@/lib/cart";
import type { CartLine } from "@/lib/client/cart-store";

/** The signed-in customer's saved cart (RLS: carts_own). */
export async function loadServerCart(userId: string): Promise<CartItemRef[]> {
  const rows = await asUser(userId, (q) =>
    q.query<{ items: CartItemRef[] }>("select items from public.carts where user_id = $1", [userId]),
  );
  return Array.isArray(rows[0]?.items) ? rows[0]!.items : [];
}

/** Upserts the signed-in customer's cart as that user, so RLS checks ownership. */
export async function saveServerCart(userId: string, items: CartItemRef[]): Promise<void> {
  await asUser(userId, (q) =>
    q.query(
      `insert into public.carts (user_id, items, updated_at) values ($1, $2::jsonb, now())
       on conflict (user_id) do update set items = excluded.items, updated_at = now()`,
      [userId, JSON.stringify(items)],
    ),
  );
}

/**
 * Rebuilds display lines from the database (live prices, labels, live gift). Lines whose product or
 * bundle is no longer on sale are dropped. Prices remain display-only: create_order recomputes.
 */
export async function priceCartItems(items: CartItemRef[]): Promise<CartLine[]> {
  const products = new Map<string, Awaited<ReturnType<typeof getProductById>>>();
  for (const id of new Set(items.map((i) => i.productId))) products.set(id, await getProductById(id));
  const lines: CartLine[] = [];
  for (const item of items) {
    const p = products.get(item.productId);
    if (!p) continue;
    const bundle = item.bundleId ? p.bundles.find((b) => b.id === item.bundleId) : null;
    if (item.bundleId && !bundle) continue;
    lines.push({
      productId: p.id,
      bundleId: bundle?.id ?? null,
      packs: item.packs,
      slug: p.slug,
      name: p.name,
      imageUrl: p.imageUrl,
      bundleLabel: bundle ? (bundle.shortLabel ?? bundle.label) : null,
      unitPriceKobo: bundle?.priceKobo ?? p.priceKobo,
      compareAtKobo: bundle ? bundle.compareAtKobo : p.compareAtKobo,
      giftName: p.gift?.name ?? null,
    });
  }
  return lines;
}
