import { Suspense } from "react";
import { MetaPixel } from "@/components/analytics/meta-pixel";

/**
 * Ad landing pages live outside the storefront chrome on purpose: no category nav, search, cart or
 * bottom nav — just the logo and WhatsApp (minimal navigation leakage for ad traffic).
 * MetaPixel also captures UTM/fbclid attribution on arrival.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MetaPixel />
      </Suspense>
    </>
  );
}
