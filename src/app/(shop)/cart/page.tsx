import type { Metadata } from "next";
import { CartView } from "@/components/storefront/cart-view";
import { getDeliveryZones, getPublicSettings } from "@/server/services/settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Your Cart",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const [zones, settings] = await Promise.all([getDeliveryZones(), getPublicSettings()]);
  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <h1 className="font-display text-headline-xl font-bold text-navy">Your Cart</h1>
      <CartView zones={zones} cutoff={settings.sameDayCutoff} />
    </div>
  );
}
