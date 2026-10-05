import "server-only";
import { asService } from "../db";
import { notify } from "../adapters/notify";
import { statusUpdateMessage } from "@/lib/chat/status-messages";
import { absoluteUrl } from "@/lib/site";

/** Texts the customer when their order reaches a milestone (best effort; never blocks staff actions). */
export async function notifyCustomerOfStatus(orderId: string, status: string, reason?: string | null): Promise<void> {
  try {
    const rows = await asService((q) =>
      q.query<{ orderNumber: string; phoneE164: string }>(
        `select order_number as "orderNumber", phone_e164 as "phoneE164" from public.orders where id = $1`,
        [orderId],
      ),
    );
    const o = rows[0];
    if (!o) return;
    const body = statusUpdateMessage(status, {
      orderNumber: o.orderNumber,
      trackUrl: absoluteUrl(`/track?o=${encodeURIComponent(o.orderNumber)}`),
      reason,
    });
    if (!body) return;
    await notify({ channel: "sms", to: o.phoneE164, template: `customer_status_${status}`, body, orderId });
  } catch (err) {
    console.error("[notify] status update failed", err);
  }
}
