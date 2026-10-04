"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface LandingBundleSummary {
  id: string;
  label: string;
  quantity: number;
  priceKobo: number;
}

interface LandingState {
  bundles: LandingBundleSummary[];
  bundleId: string | null;
  setBundleId: (id: string) => void;
  /** Selected bundle, or null when the product has no bundles. */
  bundle: LandingBundleSummary | null;
  /** Live price of the selection (bundle price, else the product's single-unit price). */
  priceKobo: number;
  /** Delivery state the customer picked in the order form (drives the nearest-hub stock meter). */
  deliveryState: string | null;
  setDeliveryState: (state: string) => void;
}

const Ctx = createContext<LandingState | null>(null);

/**
 * Shared selection state for the ad landing page: the chosen bundle (bundle cards, order form
 * summary, sticky bar) and the chosen delivery state (stock meter). Everything else is server-rendered.
 */
export function LandingProvider({
  bundles,
  defaultBundleId,
  fallbackPriceKobo,
  children,
}: {
  bundles: LandingBundleSummary[];
  defaultBundleId: string | null;
  fallbackPriceKobo: number;
  children: React.ReactNode;
}) {
  const [bundleId, setBundleIdState] = useState<string | null>(defaultBundleId);
  const [deliveryState, setDeliveryStateRaw] = useState<string | null>(null);
  const setBundleId = useCallback((id: string) => setBundleIdState(id), []);
  const setDeliveryState = useCallback((s: string) => setDeliveryStateRaw(s), []);

  const value = useMemo<LandingState>(() => {
    const bundle = bundles.find((b) => b.id === bundleId) ?? null;
    return {
      bundles,
      bundleId,
      setBundleId,
      bundle,
      priceKobo: bundle?.priceKobo ?? fallbackPriceKobo,
      deliveryState,
      setDeliveryState,
    };
  }, [bundles, bundleId, setBundleId, fallbackPriceKobo, deliveryState, setDeliveryState]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLanding(): LandingState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLanding must be used inside <LandingProvider>");
  return v;
}
