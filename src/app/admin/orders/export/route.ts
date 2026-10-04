import { getSession, STAFF_ROLES } from "@/server/session";
import { exportOrders } from "@/server/services/admin-orders";
import { parseOrderFilters, toCsv } from "@/lib/admin-orders";
import { koboToNairaInput } from "@/lib/money";
import { formatLagosDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

/** CSV export of the current order filters (staff only; amounts in naira for spreadsheets). */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !STAFF_ROLES.includes(session.role)) return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const f = parseOrderFilters(Object.fromEntries(url.searchParams));
  const rows = await exportOrders(session, f);
  const csv = toCsv([
    ["Order", "Placed (Lagos)", "Status", "Payment", "Customer", "Phone", "State", "City", "Address", "Landmark", "Items",
     "Subtotal (NGN)", "Delivery (NGN)", "Total (NGN)", "Paid (NGN)", "Chat channel", "Chat opened", "Source", "UTM source", "UTM campaign", "Dispatcher", "Duplicate?"],
    ...rows.map((o) => [
      o.orderNumber, formatLagosDateTime(o.createdAt), o.status, o.paymentStatus, o.customerName, o.phoneE164, o.state, o.city, o.address,
      o.landmark, o.itemsSummary, koboToNairaInput(o.subtotalKobo), koboToNairaInput(o.deliveryFeeKobo), koboToNairaInput(o.totalKobo),
      koboToNairaInput(o.amountPaidKobo), o.chatChannel, o.chatClickedAt ? "yes" : "no", o.source, o.utmSource, o.utmCampaign,
      o.dispatcherName, o.isDuplicateSuspect ? "yes" : "no",
    ]),
  ]);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="mubazzar-orders-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
