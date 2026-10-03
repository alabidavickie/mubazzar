import { isBeforeLagosCutoff } from "./time";
import type { Kobo } from "./money";

/** Mirrors public.delivery_zones and public.quote_delivery() in SQL. */
export interface DeliveryZone {
  state: string;
  displayName: string;
  feeKobo: Kobo;
  etaMinDays: number;
  etaMaxDays: number;
  sameDayEnabled: boolean;
  hubCode: string;
}

export interface DeliveryQuote {
  feeKobo: Kobo;
  etaMinDays: number;
  etaMaxDays: number;
  sameDay: boolean;
  hubCode: string;
  label: string;
}

export function quoteDelivery(zone: DeliveryZone, cutoff: string, now: Date = new Date()): DeliveryQuote {
  const sameDay = zone.sameDayEnabled && isBeforeLagosCutoff(cutoff, now);
  const etaMinDays = sameDay ? 0 : zone.etaMinDays;
  const etaMaxDays = sameDay ? 0 : zone.etaMaxDays;
  return {
    feeKobo: zone.feeKobo,
    etaMinDays,
    etaMaxDays,
    sameDay,
    hubCode: zone.hubCode,
    label: etaLabel({ sameDay, etaMinDays, etaMaxDays }),
  };
}

export function etaLabel(q: { sameDay: boolean; etaMinDays: number; etaMaxDays: number }): string {
  if (q.sameDay) return "Same-day delivery";
  if (q.etaMaxDays <= 1) return "Next-day delivery";
  if (q.etaMinDays === q.etaMaxDays) return `${q.etaMinDays} working days`;
  return `${q.etaMinDays}–${q.etaMaxDays} working days`;
}
