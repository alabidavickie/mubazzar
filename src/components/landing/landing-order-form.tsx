"use client";

import { OrderForm, type OrderFormChannel } from "@/components/order/order-form";
import type { DeliveryZone } from "@/lib/delivery";
import { useLanding } from "./landing-provider";

export interface LandingOrderFormProps {
  productId: string;
  productName: string;
  landingPageId: string;
  zones: DeliveryZone[];
  channels: OrderFormChannel[];
  cutoff: string;
}

/** The shared OrderForm wired to the landing page's selected bundle and the stock meter's state. */
export function LandingOrderForm({ productId, productName, landingPageId, zones, channels, cutoff }: LandingOrderFormProps) {
  const { bundle, priceKobo, setDeliveryState } = useLanding();
  return (
    <OrderForm
      source="landing_page"
      idPrefix="lp"
      landingPageId={landingPageId}
      items={[{ productId, bundleId: bundle?.id ?? null, packs: 1 }]}
      summaryLabel={bundle?.label ?? `1x ${productName}`}
      subtotalKobo={priceKobo}
      zones={zones}
      channels={channels}
      cutoff={cutoff}
      onStateChange={setDeliveryState}
      analytics={{ contentIds: [productId], value: priceKobo }}
    />
  );
}
