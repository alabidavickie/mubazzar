import type { Metadata } from "next";
import { CheckoutView } from "@/components/storefront/checkout-view";
import { getDeliveryZones, getEnabledChannels, getPublicSettings } from "@/server/services/settings";
import { CHANNEL_LABEL } from "@/lib/chat/links";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [zones, channels, settings] = await Promise.all([getDeliveryZones(), getEnabledChannels(), getPublicSettings()]);
  const kinds = [...new Set(channels.map((c) => c.kind))].map((k) => ({ kind: k, label: CHANNEL_LABEL[k] }));
  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <div>
        <h1 className="font-display text-headline-xl font-bold text-navy">Checkout</h1>
        <p className="text-body-md text-ink-muted">Place your order, then confirm and pay with our team in chat.</p>
      </div>
      <CheckoutView zones={zones} channels={kinds} cutoff={settings.sameDayCutoff} />
    </div>
  );
}
