import type { Kobo } from "./money";

/**
 * Display-side pricing. The server never trusts these numbers: public.create_order()
 * recomputes every line from the database. These mirror that logic so the UI shows
 * the same totals the customer will be charged.
 */

export interface FlashDealWindow {
  dealPriceKobo: Kobo | null;
  startsAt: string | Date;
  endsAt: string | Date;
  isActive: boolean;
}

export function isDealLive(deal: FlashDealWindow, now: Date = new Date()): boolean {
  const start = new Date(deal.startsAt).getTime();
  const end = new Date(deal.endsAt).getTime();
  const t = now.getTime();
  return deal.isActive && t >= start && t < end;
}

/** Lowest of the regular price and any live flash-deal price (mirrors public.effective_unit_price). */
export function effectiveUnitPrice(priceKobo: Kobo, deals: FlashDealWindow[] = [], now: Date = new Date()): Kobo {
  let best = priceKobo;
  for (const d of deals) {
    if (d.dealPriceKobo !== null && isDealLive(d, now) && d.dealPriceKobo < best) best = d.dealPriceKobo;
  }
  return best;
}

export interface PricedLine {
  unitPriceKobo: Kobo; // price per pack (bundle price or effective unit price)
  packs: number;
}

export function lineTotal(line: PricedLine): Kobo {
  return line.unitPriceKobo * line.packs;
}

export interface OrderTotals {
  subtotalKobo: Kobo;
  deliveryFeeKobo: Kobo;
  totalKobo: Kobo;
}

export function orderTotals(lines: PricedLine[], deliveryFeeKobo: Kobo | null): OrderTotals {
  const subtotalKobo = lines.reduce((s, l) => s + lineTotal(l), 0);
  const fee = deliveryFeeKobo ?? 0;
  return { subtotalKobo, deliveryFeeKobo: fee, totalKobo: subtotalKobo + fee };
}

/** Units of physical stock a line consumes (bundle quantity × packs). */
export function lineUnits(packs: number, bundleQuantity: number | null | undefined): number {
  return packs * (bundleQuantity ?? 1);
}

/** "Save extra ₦4,000" for a bundle vs buying single units at the single-bundle price. */
export function bundleExtraSavingKobo(bundlePriceKobo: Kobo, bundleQuantity: number, singlePriceKobo: Kobo): Kobo {
  return Math.max(singlePriceKobo * bundleQuantity - bundlePriceKobo, 0);
}
