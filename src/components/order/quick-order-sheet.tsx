"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/misc";
import { formatNaira } from "@/lib/money";
import { track } from "@/lib/client/pixel";
import { BundleSelector, QuantityStepper, type SelectableBundle } from "./bundle-selector";
import { OrderForm, type OrderFormChannel } from "./order-form";
import type { DeliveryZone } from "@/lib/delivery";

export interface QuickOrderPayload {
  product: {
    id: string;
    slug: string;
    name: string;
    imageUrl: string | null;
    priceKobo: number;
    compareAtKobo: number | null;
    giftName: string | null;
    availableUnits: number;
    bundles: SelectableBundle[];
  };
  zones: DeliveryZone[];
  channels: OrderFormChannel[];
  cutoff: string;
}

/** 1-tap Quick Order: compact bundle/qty choice + the shared order form, in a bottom sheet. */
export function QuickOrderSheet({ productId, open, onClose }: { productId: string; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<QuickOrderPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [packs, setPacks] = useState(1);

  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    fetch(`/api/quick-order/${productId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: QuickOrderPayload) => {
        if (cancelled) return;
        setData(d);
        const popular = d.product.bundles.find((b) => b.quantity === 1) ?? d.product.bundles[0];
        setBundleId(popular?.id ?? null);
        track("ViewContent", { content_ids: [d.product.id], content_type: "product", value: d.product.priceKobo / 100, currency: "NGN" });
      })
      .catch(() => !cancelled && setError("Couldn't load this product. Check your connection and try again."));
    return () => {
      cancelled = true;
    };
  }, [open, data, productId]);

  const bundle = data?.product.bundles.find((b) => b.id === bundleId) ?? null;
  const unit = bundle ? bundle.priceKobo : (data?.product.priceKobo ?? 0);
  const subtotal = unit * packs;
  const summaryLabel = bundle ? (packs > 1 ? `${packs} × ${bundle.label}` : bundle.label) : `${packs}x ${data?.product.name ?? ""}`;

  return (
    <Sheet open={open} onClose={onClose} title="Quick Order" description="No account needed · Pay on WhatsApp after ordering">
      {error ? <p className="py-6 text-center text-body-md text-urgent">{error}</p> : null}
      {!data && !error ? (
        <div className="flex flex-col gap-3 py-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : null}
      {data ? (
        <div className="flex flex-col gap-4" data-testid="quick-order">
          <div className="flex items-center gap-3">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-surface-high">
              {data.product.imageUrl ? <Image src={data.product.imageUrl} alt="" fill sizes="64px" className="object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 text-label-lg font-bold text-navy">{data.product.name}</p>
              <p className="text-body-sm text-ink-muted">
                {formatNaira(data.product.priceKobo)}
                {data.product.giftName ? ` · Free ${data.product.giftName}` : ""}
              </p>
            </div>
          </div>
          {data.product.bundles.length > 0 ? (
            <BundleSelector bundles={data.product.bundles} value={bundleId} onChange={setBundleId} name={`qo-${productId}`} compact />
          ) : (
            <QuantityStepper value={packs} onChange={setPacks} max={Math.max(1, Math.min(20, data.product.availableUnits))} />
          )}
          <OrderForm
            source="quick_order"
            idPrefix={`qo-${productId.slice(0, 8)}`}
            items={[{ productId: data.product.id, bundleId: bundle?.id ?? null, packs }]}
            summaryLabel={summaryLabel}
            subtotalKobo={subtotal}
            zones={data.zones}
            channels={data.channels}
            cutoff={data.cutoff}
            compact
            analytics={{ contentIds: [data.product.id], value: subtotal }}
          />
        </div>
      ) : null}
    </Sheet>
  );
}
