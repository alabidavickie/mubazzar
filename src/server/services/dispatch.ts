import "server-only";
import { asUser } from "../db";
import type { Session } from "../session";
import { getPrivateSetting } from "./settings";
import { buildMessage, type TemplateSet } from "@/lib/chat/templates";
import { buildWhatsAppLink } from "@/lib/chat/links";
import type { OrderView } from "./orders";

/** Rider view: only orders assigned to the signed-in dispatcher (RLS: orders_read / dispatch_read). */

export interface DispatchListRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  customerName: string;
  phoneE164: string;
  city: string;
  state: string;
  address: string;
  landmark: string | null;
  totalKobo: number;
  amountPaidKobo: number;
  podAgreed: boolean;
  assignmentStatus: string;
  assignedAt: string;
  itemsSummary: string;
}

const ROW_SELECT = `
  o.id, o.order_number as "orderNumber", o.status, o.payment_status as "paymentStatus", o.customer_name as "customerName",
  o.phone_e164 as "phoneE164", o.city, o.state, o.address, o.landmark, o.total_kobo as "totalKobo",
  o.amount_paid_kobo as "amountPaidKobo", o.pod_agreed as "podAgreed", da.status as "assignmentStatus", da.assigned_at as "assignedAt",
  coalesce((select string_agg(oi.units || 'x ' || oi.name, ', ' order by oi.is_free_gift, oi.name)
              from public.order_items oi where oi.order_id = o.id), '') as "itemsSummary"`;

export async function listMyDeliveries(session: Session): Promise<{ active: DispatchListRow[]; recent: DispatchListRow[] }> {
  const rows = await asUser(session.userId, (q) =>
    q.query<DispatchListRow>(
      `select ${ROW_SELECT}
         from public.dispatch_assignments da join public.orders o on o.id = da.order_id
        where da.dispatcher_id = $1 and (da.status = 'assigned' or da.completed_at > now() - interval '3 days')
        order by (da.status = 'assigned') desc, da.assigned_at desc limit 100`,
      [session.userId],
    ),
  );
  return { active: rows.filter((r) => r.assignmentStatus === "assigned"), recent: rows.filter((r) => r.assignmentStatus !== "assigned") };
}

export interface DispatchDetail extends DispatchListRow {
  lines: OrderView["lines"];
  balanceKobo: number;
  mapsUrl: string;
  whatsappUrl: string;
  callUrl: string;
}

export async function getMyDelivery(session: Session, orderId: string): Promise<DispatchDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const rows = await asUser(session.userId, (q) =>
    q.query<DispatchListRow & { lines: OrderView["lines"]; subtotalKobo: number; deliveryFeeKobo: number; sameDay: boolean; etaMinDays: number; etaMaxDays: number }>(
      `select ${ROW_SELECT}, o.subtotal_kobo as "subtotalKobo", o.delivery_fee_kobo as "deliveryFeeKobo", o.same_day as "sameDay",
              o.eta_min_days as "etaMinDays", o.eta_max_days as "etaMaxDays",
              coalesce((select jsonb_agg(jsonb_build_object('name', oi.name, 'bundleLabel', oi.bundle_label, 'shortLabel', null, 'packs', oi.packs,
                  'units', oi.units, 'lineTotalKobo', oi.line_total_kobo, 'isFreeGift', oi.is_free_gift, 'imageUrl', oi.image_url)
                  order by oi.is_free_gift, oi.name) from public.order_items oi where oi.order_id = o.id), '[]'::jsonb) as lines
         from public.dispatch_assignments da join public.orders o on o.id = da.order_id
        where da.dispatcher_id = $1 and o.id = $2
        order by da.assigned_at desc limit 1`,
      [session.userId, orderId],
    ),
  );
  const r = rows[0];
  if (!r) return null;
  const templates = await getPrivateSetting<TemplateSet>("chat_templates", {});
  const message = buildMessage(
    "dispatch_contact",
    {
      orderNumber: r.orderNumber,
      customerName: r.customerName,
      phoneE164: r.phoneE164,
      state: r.state,
      city: r.city,
      address: r.address,
      lines: r.lines.map((l) => ({ name: l.name, bundleLabel: l.bundleLabel, packs: l.packs, units: l.units, isFreeGift: l.isFreeGift })),
      subtotalKobo: r.subtotalKobo,
      deliveryFeeKobo: r.deliveryFeeKobo,
      totalKobo: r.totalKobo,
    },
    templates,
  );
  const address = [r.address, r.landmark, r.city, r.state, "Nigeria"].filter(Boolean).join(", ");
  return {
    ...r,
    balanceKobo: Math.max(r.totalKobo - r.amountPaidKobo, 0),
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    whatsappUrl: buildWhatsAppLink(r.phoneE164, message),
    callUrl: `tel:${r.phoneE164}`,
  };
}
