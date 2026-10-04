"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { cx } from "@/lib/cx";
import { formatNaira } from "@/lib/money";
import { BundleSelector, QuantityStepper, type SelectableBundle } from "@/components/order/bundle-selector";
import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { QuickOrderButton } from "@/components/commerce/quick-order-button";
import type { CartLine } from "@/lib/client/cart-store";

export interface PdpProduct {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  priceKobo: number;
  compareAtKobo: number | null;
  giftName: string | null;
  availableUnits: number;
}

export interface PdpBundle extends SelectableBundle {
  shortLabel: string | null;
}

interface PurchaseState {
  product: PdpProduct;
  bundles: PdpBundle[];
  bundle: PdpBundle | null;
  bundleId: string | null;
  setBundleId: (id: string) => void;
  qty: number;
  setQty: (n: number) => void;
  /** Display price of the current selection (server recomputes at order time). */
  totalKobo: number;
  compareKobo: number | null;
  line: Omit<CartLine, "packs">;
  packs: number;
  soldOut: boolean;
}

const Ctx = createContext<PurchaseState | null>(null);

function usePurchase(): PurchaseState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePurchase must be used inside <PdpPurchaseProvider>");
  return v;
}

/** Shared selection (bundle or quantity) for the product page's buy panel and sticky bar. */
export function PdpPurchaseProvider({
  product,
  bundles,
  children,
}: {
  product: PdpProduct;
  bundles: PdpBundle[];
  children: React.ReactNode;
}) {
  const initial = bundles.find((b) => b.quantity === 1) ?? bundles[0] ?? null;
  const [bundleId, setBundleId] = useState<string | null>(initial?.id ?? null);
  const [qty, setQty] = useState(1);

  const value = useMemo<PurchaseState>(() => {
    const bundle = bundles.find((b) => b.id === bundleId) ?? null;
    const unit = bundle ? bundle.priceKobo : product.priceKobo;
    const unitCompare = bundle ? bundle.compareAtKobo : product.compareAtKobo;
    const packs = bundle ? 1 : qty;
    return {
      product,
      bundles,
      bundle,
      bundleId,
      setBundleId,
      qty,
      setQty,
      totalKobo: unit * packs,
      compareKobo: unitCompare && unitCompare > unit ? unitCompare * packs : null,
      packs,
      soldOut: product.availableUnits <= 0,
      line: {
        productId: product.id,
        bundleId: bundle?.id ?? null,
        slug: product.slug,
        name: product.name,
        imageUrl: product.imageUrl,
        bundleLabel: bundle ? (bundle.shortLabel ?? bundle.label) : null,
        unitPriceKobo: unit,
        compareAtKobo: unitCompare,
        giftName: product.giftName,
      },
    };
  }, [bundles, bundleId, product, qty]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Bundle choice (or quantity) + Add to Cart + Quick Order. */
export function PdpBuyPanel() {
  const p = usePurchase();
  const maxQty = Math.max(1, Math.min(20, p.product.availableUnits));
  return (
    <div className="flex flex-col gap-3" id="pdp-buy" data-testid="pdp-buy">
      {p.bundles.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-label-sm tracking-wider text-bronze uppercase">Choose your package</legend>
          <BundleSelector bundles={p.bundles} value={p.bundleId} onChange={p.setBundleId} name="pdp-bundle" />
        </fieldset>
      ) : (
        <QuantityStepper value={p.qty} onChange={p.setQty} max={maxQty} />
      )}
      <div className="flex items-baseline justify-between gap-2 rounded-lg bg-surface-low px-3 py-2">
        <span className="text-label-md text-ink-muted">{p.bundle ? p.bundle.label : `${p.qty} × ${p.product.name}`}</span>
        <span className="shrink-0 text-headline-sm font-extrabold text-navy-deep tabular" data-testid="pdp-selection-price">
          {formatNaira(p.totalKobo)}
        </span>
      </div>
      {p.soldOut ? (
        <p className="rounded-lg bg-surface-high p-3 text-body-sm text-ink" role="status">
          This batch is sold out in every hub. Chat with us on WhatsApp and we&apos;ll tell you when the next batch lands.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <AddToCartButton line={p.line} packs={p.packs} />
          <QuickOrderButton
            productId={p.product.id}
            productName={p.product.name}
            label="Quick Order"
            icon="flash_on"
            className="h-12 text-label-lg"
          />
        </div>
      )}
      <p className="text-body-sm text-ink-muted">
        No card details needed. After ordering, our team confirms on WhatsApp and shares payment details — Pay on Delivery can
        be arranged in chat.
      </p>
    </div>
  );
}

/** Mobile sticky add-to-cart bar, shown once the buy panel scrolls out of view. */
export function PdpStickyBar() {
  const p = usePurchase();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById("pdp-buy");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      // Show only after the shopper has scrolled past the panel (not before reaching it).
      setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (p.soldOut) return null;

  return (
    <>
      {show ? (
        // Lift the floating WhatsApp button above this bar on phones.
        <style>{`@media (max-width: 1023px){[data-testid="floating-whatsapp"]{bottom:9.5rem}}`}</style>
      ) : null}
      <div
        data-testid="pdp-sticky-bar"
        data-visible={show ? "true" : "false"}
        inert={!show}
        className={cx(
          "fixed inset-x-0 bottom-16 z-30 border-t border-line bg-card/95 shadow-dock backdrop-blur-md transition-transform duration-300 lg:hidden",
          show ? "visible translate-y-0" : "invisible pointer-events-none translate-y-[calc(100%+4rem)]",
        )}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-label-sm text-ink-muted">{p.bundle ? (p.bundle.shortLabel ?? p.bundle.label) : p.product.name}</p>
            <p className="flex items-baseline gap-1.5">
              <span className="text-headline-sm font-extrabold text-navy-deep tabular">{formatNaira(p.totalKobo)}</span>
              {p.compareKobo ? (
                <s className="text-body-sm text-ink-subtle">
                  <span className="sr-only">Was </span>
                  {formatNaira(p.compareKobo)}
                </s>
              ) : null}
            </p>
          </div>
          <div className="w-36 shrink-0">
            <AddToCartButton line={p.line} packs={p.packs} label="Add to Cart" className="min-h-11 border-navy bg-navy px-3 text-on-dark hover:bg-navy-ink" />
          </div>
        </div>
      </div>
    </>
  );
}
