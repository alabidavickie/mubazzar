/**
 * Honest stock copy (BRIEF §0.8). Pure so the server, the landing page island and tests share it.
 *
 * - "Only N left" appears only when the TOTAL units the product can actually ship (available stock
 *   summed across active hubs) is at or below the low-stock threshold (lowest hub threshold).
 * - Otherwise: "In stock — ships from {nearest hub}" when the nearest hub has stock, else the hub
 *   that will ship it (the central warehouse first) with the delivery days for the customer's state.
 * - No "% of batch sold" meters: batch sizes are typed by staff, not sales data.
 */

export interface HubAvailability {
  hubCode: string;
  hubName: string;
  available: number;
  lowStockThreshold: number;
}

export type StockStatus =
  | { kind: "out" }
  | { kind: "low"; units: number }
  | { kind: "nearest"; hubName: string }
  | { kind: "fallback"; hubName: string; isWarehouse: boolean; etaMinDays: number; etaMaxDays: number };

export const WAREHOUSE_HUB = "warehouse";

/** Short hub label for copy: "Lagos Hub (Ikeja)" → "Lagos Hub". */
export function shortHubName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, "");
}

export function totalAvailable(stock: HubAvailability[]): number {
  return stock.reduce((sum, s) => sum + Math.max(0, s.available), 0);
}

export function lowStockThreshold(stock: HubAvailability[]): number {
  return stock.length ? Math.min(...stock.map((s) => s.lowStockThreshold)) : 0;
}

export function stockStatus(
  stock: HubAvailability[],
  nearestHub: string | null,
  eta: { etaMinDays: number; etaMaxDays: number },
): StockStatus {
  const total = totalAvailable(stock);
  if (total <= 0) return { kind: "out" };
  if (total <= lowStockThreshold(stock)) return { kind: "low", units: total };
  const nearest = stock.find((s) => s.hubCode === nearestHub);
  if (nearest && nearest.available > 0) return { kind: "nearest", hubName: shortHubName(nearest.hubName) };
  const ships =
    stock.find((s) => s.hubCode === WAREHOUSE_HUB && s.available > 0) ?? stock.find((s) => s.available > 0)!;
  return {
    kind: "fallback",
    hubName: shortHubName(ships.hubName),
    isWarehouse: ships.hubCode === WAREHOUSE_HUB,
    etaMinDays: eta.etaMinDays,
    etaMaxDays: eta.etaMaxDays,
  };
}

/** "1 day" · "2–4 days" */
export function formatDayRange(min: number, max: number): string {
  if (max <= min) return `${min} ${min === 1 ? "day" : "days"}`;
  return `${min}–${max} days`;
}

/** One-line copy for a status (the StockMeter renders the same words with icons). */
export function stockStatusText(s: StockStatus): string {
  switch (s.kind) {
    case "out":
      return "Sold out right now — message us to be told when it's back";
    case "low":
      return `Only ${s.units} left`;
    case "nearest":
      return `In stock — ships from ${s.hubName}`;
    case "fallback":
      return `In stock — ships from ${s.isWarehouse ? "our central warehouse" : s.hubName} in ${formatDayRange(s.etaMinDays, s.etaMaxDays)}`;
  }
}

/** Delivery days for a state's zone, or the nationwide range when the state is unknown. */
export function etaForState(
  state: string | null | undefined,
  zones: { state: string; etaMinDays: number; etaMaxDays: number }[],
): { etaMinDays: number; etaMaxDays: number } {
  const zone = state ? zones.find((z) => z.state === state) : undefined;
  if (zone) return { etaMinDays: zone.etaMinDays, etaMaxDays: zone.etaMaxDays };
  if (!zones.length) return { etaMinDays: 2, etaMaxDays: 4 };
  return {
    etaMinDays: Math.min(...zones.map((z) => z.etaMinDays)),
    etaMaxDays: Math.max(...zones.map((z) => z.etaMaxDays)),
  };
}
