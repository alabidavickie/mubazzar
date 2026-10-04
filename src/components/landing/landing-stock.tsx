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
  defaultState,
}: {
  stock: HubStockInfo[];
  stateHubs: { state: string; hubCode: string; etaMinDays: number; etaMaxDays: number }[];
  defaultHub: string;
  defaultState: string | null;
}) {
  const { deliveryState } = useLanding();
  const selectedState = deliveryState ?? defaultState;
  const zone = stateHubs.find((candidate) => candidate.state === selectedState) ?? stateHubs.find((candidate) => candidate.hubCode === defaultHub);
  const hub = hubForState(selectedState, stateHubs) ?? defaultHub;
  const info = stock.find((s) => s.hubCode === hub) ?? stock.find((s) => s.hubCode === defaultHub) ?? null;
  return (
    <div data-hub={info?.hubCode ?? ""} aria-live="polite">
      <StockMeter
        stock={stock}
        nearestHub={info?.hubCode ?? null}
        eta={{ etaMinDays: zone?.etaMinDays ?? 1, etaMaxDays: zone?.etaMaxDays ?? 3 }}
      />
    </div>
  );
}
