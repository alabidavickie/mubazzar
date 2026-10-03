import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { FloatingWhatsApp } from "@/components/layout/floating-whatsapp";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { getCategories, maxActiveDiscountPercent } from "@/server/services/catalog";
import { getPublicSettings } from "@/server/services/settings";
import { buildWhatsAppLink } from "@/lib/chat/links";

/** Storefront chrome shared by every customer page except ad landing pages. */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories, maxDiscount] = await Promise.all([
    getPublicSettings(),
    getCategories(),
    maxActiveDiscountPercent(),
  ]);
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded bg-navy px-4 py-2 text-on-dark focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SiteHeader promoStrip={settings.promoStrip} categories={categories} supportWhatsApp={settings.support.whatsapp} />
      <main id="main" className="mx-auto min-h-[60dvh] w-full max-w-(--container-site) pb-6">
        {children}
      </main>
      <SiteFooter settings={settings} />
      <BottomNav
        whatsappHref={buildWhatsAppLink(settings.support.whatsapp, "Hello MUBAZZAR, I need help with an order.")}
        maxDiscount={maxDiscount}
      />
      <FloatingWhatsApp number={settings.support.whatsapp} />
      <Suspense fallback={null}>
        <MetaPixel />
      </Suspense>
    </>
  );
}
