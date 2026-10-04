"use client";

import { StockMeter, type HubStockInfo } from "@/components/commerce/stock-meter";
import { hubForState } from "@/lib/landing";
import { useLanding } from "./landing-provider";

/**
 * Real stock for the visitor's nearest hub (from geo on the server); switches to the hub that
 * ships to the state the customer picks in the order form.
 */
export function LandingStock({
  stock,
  stateHubs,
  defaultHub,
}: {
  stock: HubStockInfo[];
  stateHubs: { state: string; hubCode: string }[];
  defaultHub: string;
}) {
  const { deliveryState } = useLanding();
  const hub = hubForState(deliveryState, stateHubs) ?? defaultHub;
  const info = stock.find((s) => s.hubCode === hub) ?? stock.find((s) => s.hubCode === defaultHub) ?? null;
  return (
    <div data-hub={info?.hubCode ?? ""} aria-live="polite">
      <StockMeter stock={info} />
    </div>
  );
}
