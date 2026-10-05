/**
 * Default ad landing page for a product that has no custom one yet, so every product can be
 * advertised at `/lp/<product-slug>` right away. Content comes only from the product itself (no
 * invented trends, timers or regions); staff can still build a custom page in Admin → Landing pages.
 */

export interface AutoLandingProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  warrantyMonths: number;
  gift: { name: string } | null;
  /** The product's live promo deadline (null when no promo is running). */
  promoEndsAt: string | null;
  /** Feature titles already shown on the page; trust points that repeat one are left out. */
  features: { title: string }[];
}

export interface AutoLandingSection {
  id: string;
  kind: "trust_matrix";
  title: string;
  items: { icon: string; title: string; body: string }[];
  body: null;
}

export function autoLandingPage(p: AutoLandingProduct) {
  const trust: AutoLandingSection["items"] = [
    {
      icon: "payments",
      title: "Pay On Delivery (Arrange in Chat)",
      body: "Agree Pay on Delivery with our team on WhatsApp, then inspect before paying the rider by cash, POS or transfer.",
    },
    {
      icon: "rocket_launch",
      title: "Fast Nationwide Delivery",
      body: "Same-day in Lagos & Abuja before the daily cut-off. 2 to 4 working days across all 36 states.",
    },
  ];
  if (p.warrantyMonths > 0) {
    trust.push({
      icon: "verified_user",
      title: `${p.warrantyMonths}-Month MUBAZZAR Warranty`,
      body: "Any factory fault within the warranty? We replace it free.",
    });
  }
  const shown = new Set(p.features.map((f) => f.title.trim().toLowerCase()));
  const items = trust.filter((t) => !shown.has(t.title.toLowerCase()));
  return {
    id: null,
    slug: p.slug,
    isPublished: true,
    hookLabel: p.promoEndsAt ? "PROMO ALERT" : p.gift ? "FREE GIFT" : "ORDER TODAY",
    hookBanner: p.gift ? `Free ${p.gift.name} with your order | Pay on Delivery available` : "Pay on Delivery available — arrange it in chat",
    trendBadge: null,
    headline: p.name,
    subheadline: p.shortDescription,
    heroOverlayText: null,
    heroOverlayIcon: null,
    warrantyBadge: p.warrantyMonths > 0 ? `${p.warrantyMonths}-Month Warranty` : null,
    regionsText: null,
    campaignEndsAt: null,
    featuresTitle: null,
    featuresSubtitle: null,
    videoUrl: null,
    videoPosterUrl: null,
    videoTitle: null,
    videoSubtitle: null,
    ctaLabel: "Order now",
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    ogImageUrl: null,
    productId: p.id,
    sections: [{ id: `auto-trust-${p.id}`, kind: "trust_matrix", title: "Shop With Zero Risk", items, body: null }] as AutoLandingSection[],
  };
}
