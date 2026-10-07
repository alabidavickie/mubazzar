"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { WishlistButton } from "@/components/account/wishlist-button";
import { cartCount, useCart } from "@/lib/client/cart-store";
import { useLanding } from "./landing-provider";

export interface LandingCartProps {
  product: {
    id: string;
    slug: string;
    name: string;
    imageUrl: string | null;
    giftName: string | null;
    /** Live single-unit price (promo-aware) — display only, the server re-prices at checkout. */
    priceKobo: number;
    compareAtKobo: number | null;
  };
  bundles: { id: string; label: string; shortLabel: string | null; priceKobo: number; compareAtKobo: number | null }[];
}

/**
 * "Add to cart" for the package the visitor picked above, plus wishlist and a way on to the cart.
 * Loaded lazily (see deferred-cart-actions) so the landing page's first-load JS stays small.
 */
export function LandingCartActions({ product, bundles, autoAdd = false }: LandingCartProps & { autoAdd?: boolean }) {
  const { bundleId } = useLanding();
  const count = cartCount(useCart((s) => s.lines));
  const bundle = bundles.find((b) => b.id === bundleId) ?? null;
  const line = {
    productId: product.id,
    bundleId: bundle?.id ?? null,
    slug: product.slug,
    name: product.name,
    imageUrl: product.imageUrl,
    bundleLabel: bundle ? (bundle.shortLabel ?? bundle.label) : null,
    unitPriceKobo: bundle ? bundle.priceKobo : product.priceKobo,
    compareAtKobo: bundle ? bundle.compareAtKobo : product.compareAtKobo,
    giftName: product.giftName,
  };
  return (
    <>
      <AddToCartButton line={line} packs={1} label="Add to cart" autoAdd={autoAdd} />
      <div className="flex min-h-11 flex-wrap items-center gap-x-3">
        <WishlistButton productId={product.id} productName={product.name} />
        {count > 0 ? (
          <Link
            href="/cart"
            data-testid="lp-cart-link"
            className="inline-flex min-h-11 items-center gap-1 text-label-md font-bold text-navy underline-offset-2 hover:underline"
          >
            <Icon name="shopping_bag" className="text-base" /> View cart ({count})
          </Link>
        ) : null}
        <Link href="/shop" className="inline-flex min-h-11 items-center gap-1 text-label-md text-ink-muted underline-offset-2 hover:underline">
          Keep shopping <Icon name="arrow_forward" className="text-base" />
        </Link>
      </div>
    </>
  );
}
