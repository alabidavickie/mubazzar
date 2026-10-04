"use client";

import { BundleSelector, type SelectableBundle } from "@/components/order/bundle-selector";
import { useLanding } from "./landing-provider";

/** Step 1 bundle cards bound to the landing page's shared selection. */
export function LandingBundles({ bundles }: { bundles: SelectableBundle[] }) {
  const { bundleId, setBundleId } = useLanding();
  return <BundleSelector bundles={bundles} value={bundleId} onChange={setBundleId} name="lp-bundle" />;
}
