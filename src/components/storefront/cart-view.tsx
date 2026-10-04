"use client";

import Link from "next/link";
import { useState } from "react";
import { cartCount, cartSubtotal, MAX_PACKS, useCart } from "@/lib/client/cart-store";
import { formatNaira } from "@/lib/money";
import { quoteDelivery, type DeliveryZone } from "@/lib/delivery";
import { formatCutoff } from "@/lib/time";
import { optimizedImageProps } from "@/lib/image";
import { Icon } from "@/components/icons/icon";
import { Skeleton } from "@/components/ui/misc";
import { useHydratedCart } from "./use-hydrated-cart";

/** Cart page: lines with bundle labels, qty steppers, free-gift lines, subtotal and a delivery estimate. */
export function CartView({ zones, cutoff }: { zones: DeliveryZone[]; cutoff: string }) {
  const { ready, lines } = useHydratedCart();
  const setPacks = useCart((s) => s.setPacks);
  const remove = useCart((s) => s.remove);
  const [state, setState] = useState("");

  if (!ready) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <p className="sr-only" role="status">
          Loading your cart…
        </p>
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!lines.length) return <EmptyCart />;

  const subtotal = cartSubtotal(lines);
  const count = cartCount(lines);
  const zone = zones.find((z) => z.state === state) ?? null;
  const quote = zone ? quoteDelivery(zone, cutoff) : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12" data-testid="cart">
      <ul className="flex flex-col gap-2 lg:col-span-7" aria-label="Items in your cart">
        {lines.map((l) => {
          const img = l.imageUrl
            ? optimizedImageProps({ src: l.imageUrl, alt: "", width: 80, height: 80, className: "size-20 rounded-lg object-cover" })
            : null;
          const lineTotal = l.unitPriceKobo * l.packs;
          return (
            <li key={`${l.productId}:${l.bundleId ?? ""}`} className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-card" data-testid="cart-line">
              <div className="flex gap-3">
                <Link href={`/p/${l.slug}`} className="shrink-0" tabIndex={-1} aria-hidden>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- decorative, alt=""
                    <img {...img} />
                  ) : (
                    <span className="block size-20 rounded-lg bg-surface-high" />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link href={`/p/${l.slug}`} className="line-clamp-2 text-label-md font-bold text-navy hover:underline">
                    {l.name}
                  </Link>
                  {l.bundleLabel ? (
                    <span className="w-fit rounded bg-surface-container px-1.5 py-0.5 text-label-sm text-navy" data-testid="cart-bundle">
                      {l.bundleLabel}
                    </span>
                  ) : null}
                  <span className="text-body-sm text-ink-muted">
                    {formatNaira(l.unitPriceKobo)} {l.bundleLabel ? "per package" : "each"}
                  </span>
                </div>
                <span className="shrink-0 text-label-lg font-extrabold text-navy-deep tabular">{formatNaira(lineTotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center rounded-lg border-[1.5px] border-line bg-card">
                  <button
                    type="button"
                    className="flex size-11 items-center justify-center text-xl font-bold text-navy disabled:opacity-40"
                    onClick={() => setPacks(l.productId, l.bundleId, l.packs - 1)}
                    disabled={l.packs <= 1}
                    aria-label={`Decrease quantity of ${l.name}`}
                  >
                    −
                  </button>
                  <output className="w-8 text-center text-label-lg font-bold tabular" aria-live="polite" aria-label={`Quantity of ${l.name}`}>
                    {l.packs}
                  </output>
                  <button
                    type="button"
                    className="flex size-11 items-center justify-center text-xl font-bold text-navy disabled:opacity-40"
                    onClick={() => setPacks(l.productId, l.bundleId, l.packs + 1)}
                    disabled={l.packs >= MAX_PACKS}
                    aria-label={`Increase quantity of ${l.name}`}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(l.productId, l.bundleId)}
                  className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-label-md text-urgent hover:bg-urgent-soft"
                  aria-label={`Remove ${l.name} from cart`}
                >
                  <Icon name="delete" className="text-base" /> Remove
                </button>
              </div>
              {l.giftName ? (
                <p className="flex items-center justify-between gap-2 rounded-lg bg-gold-soft/25 px-2.5 py-1.5 text-label-sm text-bronze" data-testid="cart-gift">
                  <span className="flex min-w-0 items-center gap-1">
                    <Icon name="redeem" className="shrink-0 text-sm" />
                    <span className="truncate">Free gift: {l.giftName}</span>
                  </span>
                  <span className="shrink-0 font-bold">FREE</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <aside className="flex flex-col gap-3 lg:col-span-5" aria-label="Order summary">
        <div className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card lg:sticky lg:top-32">
          <h2 className="text-headline-sm font-bold text-navy">Order summary</h2>
          <label className="flex flex-col gap-1">
            <span className="text-label-md font-semibold text-navy">Estimate delivery to</span>
            <span className="relative">
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="h-12 w-full appearance-none rounded-lg border-[1.5px] border-line bg-card px-3 pr-10 text-body-md text-ink outline-none focus:border-navy"
              >
                <option value="">— Choose your state —</option>
                {zones.map((z) => (
                  <option key={z.state} value={z.state}>
                    {z.displayName}
                  </option>
                ))}
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xl text-ink-muted" />
            </span>
          </label>
          <dl className="flex flex-col gap-1 text-body-md" aria-live="polite">
            <div className="flex justify-between">
              <dt className="text-ink-muted">
                Subtotal ({count} {count === 1 ? "item" : "items"})
              </dt>
              <dd className="font-bold tabular" data-testid="cart-subtotal">
                {formatNaira(subtotal)}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between">
              <dt className="text-ink-muted">Delivery</dt>
              <dd className="font-bold tabular" data-testid="cart-delivery">
                {quote ? (quote.feeKobo === 0 ? "Free" : formatNaira(quote.feeKobo)) : "Choose state"}
              </dd>
              {quote ? (
                <dd className="flex w-full items-center gap-1 text-body-sm font-semibold text-emerald-ink">
                  <Icon name="local_shipping" className="text-sm" />
                  {quote.label}
                  {zone?.sameDayEnabled && !quote.sameDay ? ` · order before ${formatCutoff(cutoff)} for same-day` : ""}
                </dd>
              ) : null}
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
              <dt className="font-bold text-navy">Estimated total</dt>
              <dd className="text-headline-sm font-extrabold text-navy-deep tabular">{formatNaira(subtotal + (quote?.feeKobo ?? 0))}</dd>
            </div>
          </dl>
          <Link
            href="/checkout"
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg border-t-2 border-gold bg-navy px-4 text-label-lg text-on-dark uppercase shadow-raised active:scale-[0.99]"
            data-testid="checkout-cta"
          >
            <Icon name="shopping_cart_checkout" className="text-gold-soft" /> Checkout
          </Link>
          <p className="flex items-start gap-1.5 text-body-sm text-ink-muted">
            <Icon name="lock" className="mt-0.5 shrink-0 text-sm text-emerald-ink" />
            No card details on this site. You&apos;ll confirm and pay in WhatsApp chat — Pay on Delivery can be arranged there.
          </p>
        </div>
        <Link href="/shop" className="flex min-h-11 items-center justify-center gap-1 text-label-md text-navy underline-offset-2 hover:underline">
          <Icon name="arrow_back" className="text-base" /> Continue shopping
        </Link>
      </aside>
    </div>
  );
}

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-10 text-center shadow-card" data-testid="cart-empty">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-container text-navy">
        <Icon name="shopping_bag" className="text-3xl" />
      </span>
      <h2 className="text-headline-sm font-bold text-navy">Your cart is empty</h2>
      <p className="max-w-sm text-body-md text-ink-muted">Find something uncommon — every gadget is tested before it leaves our hub.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/shop" className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-navy px-5 text-label-md text-on-dark shadow-card">
          Shop all gadgets <Icon name="arrow_forward" className="text-sm" />
        </Link>
        <Link href="/deals" className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-gold-soft px-5 text-label-md text-bronze-ink shadow-card">
          <Icon name="local_fire_department" className="text-sm" /> Today&apos;s deals
        </Link>
      </div>
    </div>
  );
}
