import { NextResponse } from "next/server";
import { getProductById } from "@/server/services/catalog";
import { getDeliveryZones, getEnabledChannels, getPublicSettings } from "@/server/services/settings";
import { CHANNEL_LABEL } from "@/lib/chat/links";
import type { QuickOrderPayload } from "@/components/order/quick-order-sheet";

export async function GET(_req: Request, ctx: { params: Promise<{ productId: string }> }) {
  const { productId } = await ctx.params;
  const product = await getProductById(productId);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [zones, channels, settings] = await Promise.all([getDeliveryZones(), getEnabledChannels(), getPublicSettings()]);
  const kinds = [...new Set(channels.map((c) => c.kind))];
  const payload: QuickOrderPayload = {
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: product.imageUrl,
      priceKobo: product.priceKobo,
      compareAtKobo: product.compareAtKobo,
      giftName: product.giftName,
      availableUnits: product.availableUnits,
      bundles: product.bundles,
    },
    zones,
    channels: kinds.map((k) => ({ kind: k, label: CHANNEL_LABEL[k] })),
    cutoff: settings.sameDayCutoff,
  };
  return NextResponse.json(payload, { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=120" } });
}
