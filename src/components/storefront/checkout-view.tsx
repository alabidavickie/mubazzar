"use client";

import Link from "next/link";
import { useState } from "react";
import { cartCount, cartSubtotal, useCart } from "@/lib/client/cart-store";
import { formatNaira } from "@/lib/money";
import type { DeliveryZone } from "@/lib/delivery";
import { Icon } from "@/components/icons/icon";
import { Skeleton } from "@/components/ui/misc";
import { OrderForm, type OrderFormChannel } from "@/components/order/order-form";
import { useHydratedCart } from "./use-hydrated-cart";
import { EmptyCart } from "./cart-view";

/** Checkout: the shared order form (same schema + server logic as the landing page) fed by the cart. */
export function CheckoutView({ zones, channels, cutoff }: { zones: DeliveryZone[]; channels: OrderFormChannel[]; cutoff: string }) {
  const { ready, lines } = useHydratedCart();
  const clear = useCart((s) => s.clear);
  const [placed, setPlaced] = useState(false);

  if (placed) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-xl bg-card p-6 text-body-md text-navy shadow-card" role="status">
        <Icon name="autorenew" className="animate-spin" /> Order saved — opening your order page…
      </p>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <p className="sr-only" role="status">
          Loading checkout…
        </p>
        <Skeleton className="h-20" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!lines.length) return <EmptyCart />;

  const subtotal = cartSubtotal(lines);
  const count = cartCount(lines);
  const only = lines.length === 1 ? lines[0] : undefined;
  const summaryLabel = only
    ? only.bundleLabel
      ? only.packs > 1
        ? `${only.packs} × ${only.bundleLabel}`
        : only.bundleLabel
      : `${only.packs}x ${only.name}`
    : `${count} items from your cart`;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12" data-testid="checkout">
      <section aria-labelledby="checkout-items" className="flex flex-col gap-2 lg:order-2 lg:col-span-5">
        <div className="flex items-center justify-between">
          <h2 id="checkout-items" className="text-headline-sm font-bold text-navy">
            Your items
          </h2>
          <Link href="/cart" className="flex min-h-11 items-center text-label-md font-bold text-bronze">
            Edit cart
          </Link>
        </div>
        <ul className="flex flex-col divide-y divide-line-soft rounded-xl bg-card px-3 shadow-card">
          {lines.map((l) => (
            <li key={`${l.productId}:${l.bundleId ?? ""}`} className="flex flex-col gap-1 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 text-label-md text-ink">
                  <span className="font-bold text-navy">{l.packs}×</span> {l.bundleLabel ?? l.name}
                </span>
                <span className="shrink-0 text-label-md font-extrabold text-navy-deep tabular">{formatNaira(l.unitPriceKobo * l.packs)}</span>
              </div>
              {l.giftName ? (
                <span className="flex items-center gap-1 text-label-sm text-bronze">
                  <Icon name="redeem" className="text-sm" /> Free gift: {l.giftName}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-body-sm text-ink-muted">
          Prices shown are for display — we recheck every price and delivery fee on our server when you place the order.
        </p>
      </section>

      <section aria-labelledby="checkout-form" className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-float lg:order-1 lg:col-span-7">
        <div className="flex flex-col items-center text-center">
          <span className="mb-1 rounded-full bg-navy px-3 py-1 text-label-sm text-on-dark uppercase">No account needed</span>
          <h2 id="checkout-form" className="text-headline-md font-bold text-navy">
            Delivery details
          </h2>
          <p className="text-body-sm text-ink-muted">No card details needed. Payment is arranged securely in chat after you order.</p>
        </div>
        <OrderForm
          source="checkout"
          idPrefix="checkout"
          items={lines.map((l) => ({ productId: l.productId, bundleId: l.bundleId, packs: l.packs }))}
          summaryLabel={summaryLabel}
          subtotalKobo={subtotal}
          zones={zones}
          channels={channels}
          cutoff={cutoff}
          analytics={{ contentIds: lines.map((l) => l.productId), value: subtotal }}
          onSuccess={() => {
            setPlaced(true);
            clear();
          }}
        />
      </section>
    </div>
  );
}
