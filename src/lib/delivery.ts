import { isBeforeLagosCutoff } from "./time";
import { formatNaira, type Kobo } from "./money";

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

/**
 * A zone with fee 0 has no fixed fee: it is agreed with the customer in chat. The owner enters a real
 * fee per state in Admin → Delivery when there is one. (Nothing is ever shown as "Free" by accident.)
 */
export const IN_CHAT = "Confirmed in chat";

export function deliveryFeeText(feeKobo: Kobo): string {
  return feeKobo > 0 ? formatNaira(feeKobo) : IN_CHAT;
}

export function etaLabel(q: { sameDay: boolean; etaMinDays: number; etaMaxDays: number }): string {
  if (q.sameDay) return "Same-day delivery";
  // 0–0 days with no same-day promise = no stated time: agreed in chat.
  if (q.etaMaxDays === 0) return "Delivery time confirmed in chat";
  if (q.etaMaxDays <= 1) return "Next-day delivery";
  if (q.etaMinDays === q.etaMaxDays) return `${q.etaMinDays} working days`;
  return `${q.etaMinDays}–${q.etaMaxDays} working days`;
}
