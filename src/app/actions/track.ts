"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { asAnon } from "@/server/db";
import { hashIp, rateLimit } from "@/server/adapters/rate-limit";
import { buildHandoff, getOrderViewByToken } from "@/server/services/orders";
import { normalizeOrderNumber } from "@/lib/order-number";
import { normalizeNgPhone } from "@/lib/phone";
import { etaLabel } from "@/lib/delivery";
import {
  buildTimeline,
  ORDER_STATUS_CUSTOMER_LABEL,
  PAYMENT_STATUS_CUSTOMER_LABEL,
  type CustomerPaymentStatus,
  type OrderStatus,
  type TimelineEvent,
  type TimelineStep,
} from "@/lib/order-timeline";
import { stateDisplayName } from "@/lib/ng-states";

const trackSchema = z.object({
  orderNumber: z
    .string({ error: "Enter your order number" })
    .trim()
    .min(1, "Enter your order number")
    .max(20)
    .refine((v) => normalizeOrderNumber(v) !== null, "Order numbers look like MBZ-7K2QPA"),
  phone: z
    .string({ error: "Enter the phone number you ordered with" })
    .trim()
    .min(1, "Enter the phone number you ordered with")
    .max(20)
    .refine((v) => normalizeNgPhone(v).ok, "Enter a valid Nigerian number, e.g. 0803 123 4567"),
});

export interface TrackedOrder {
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  paymentStatus: CustomerPaymentStatus;
  paymentLabel: string;
  customerFirstName: string;
  deliverTo: string;
  etaText: string;
  placedAt: string;
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
  amountPaidKobo: number;
  items: { label: string; lineTotalKobo: number; isFreeGift: boolean }[];
  timeline: (TimelineStep & { atText: string | null })[];
  whatsappHref: string | null;
  token: string;
  orderPath: string;
}

export type TrackState =
  | { ok: true; order: TrackedOrder }
  | { ok: false; error: string; fieldErrors?: Partial<Record<"orderNumber" | "phone", string>>; values?: { orderNumber: string; phone: string } }
  | null;

interface TrackRow {
  order_number: string;
  public_token: string;
  status: OrderStatus;
  payment_status: CustomerPaymentStatus;
  customer_name: string;
  state: string;
  city: string;
  total_kobo: number;
  delivery_fee_kobo: number;
  subtotal_kobo: number;
  amount_paid_kobo: number;
  same_day: boolean;
  eta_min_days: number;
  eta_max_days: number;
  created_at: string;
  items: { name: string; bundle_label: string | null; units: number; line_total_kobo: number; is_free_gift: boolean }[];
  events: TimelineEvent[];
}

const NOT_FOUND = "We couldn't find an order with those details. Check the order number and use the phone number you ordered with.";

const lagosDate = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** Track Order: order number + phone → status, timeline and a way back into chat. Rate-limited per IP. */
export async function trackOrderAction(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const values = { orderNumber: String(formData.get("orderNumber") ?? ""), phone: String(formData.get("phone") ?? "") };
  const parsed = trackSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<"orderNumber" | "phone", string>> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0] as "orderNumber" | "phone";
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors, values };
  }

  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limited = await rateLimit(`track:ip:${hashIp(ip)}`, 10, 600);
  if (!limited.ok) {
    return { ok: false, error: "Too many lookups. Please wait a few minutes, or ask us on WhatsApp.", values };
  }

  const orderNumber = normalizeOrderNumber(parsed.data.orderNumber)!;
  const phone = normalizeNgPhone(parsed.data.phone);
  if (!phone.ok) return { ok: false, error: NOT_FOUND, values };

  const rows = await asAnon((q) =>
    q.query<{ r: TrackRow | null }>("select public.track_order($1, $2) as r", [orderNumber, phone.e164]),
  );
  const row = rows[0]?.r;
  if (!row) return { ok: false, error: NOT_FOUND, values };

  // Rebuild the chat handoff (prefilled WhatsApp link) from the order's own token.
  let whatsappHref: string | null = null;
  const view = await getOrderViewByToken(row.public_token);
  if (view) whatsappHref = (await buildHandoff(view)).whatsappHref;

  const timeline = buildTimeline(row.status, row.events).map((s) => ({
    ...s,
    atText: s.at ? lagosDate.format(new Date(s.at)) : null,
  }));

  return {
    ok: true,
    order: {
      orderNumber: row.order_number,
      status: row.status,
      statusLabel: ORDER_STATUS_CUSTOMER_LABEL[row.status] ?? row.status,
      paymentStatus: row.payment_status,
      paymentLabel: PAYMENT_STATUS_CUSTOMER_LABEL[row.payment_status] ?? row.payment_status,
      customerFirstName: row.customer_name.trim().split(/\s+/)[0] ?? "",
      deliverTo: `${row.city}, ${stateDisplayName(row.state)}`,
      etaText: etaLabel({ sameDay: row.same_day, etaMinDays: row.eta_min_days, etaMaxDays: row.eta_max_days }),
      placedAt: lagosDate.format(new Date(row.created_at)),
      subtotalKobo: Number(row.subtotal_kobo),
      deliveryFeeKobo: Number(row.delivery_fee_kobo),
      totalKobo: Number(row.total_kobo),
      amountPaidKobo: Number(row.amount_paid_kobo),
      items: row.items.map((i) => ({
        label: i.is_free_gift ? `FREE: ${i.name}` : (i.bundle_label ?? `${i.units}x ${i.name}`),
        lineTotalKobo: Number(i.line_total_kobo),
        isFreeGift: i.is_free_gift,
      })),
      timeline,
      whatsappHref,
      token: row.public_token,
      orderPath: `/order/${row.public_token}`,
    },
  };
}
