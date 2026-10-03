import "server-only";
import { createHash } from "node:crypto";
import { asService } from "../db";
import { env, services } from "../env";

/**
 * Meta Conversions API. Browser Pixel events and server events share an `event_id` so Meta
 * deduplicates them. `Purchase` is server-only and is queued exactly once per order by the
 * orders_after_update trigger (meta_events_purchase_once) when an order is first paid/delivered.
 */

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export interface CapiUserData {
  phoneE164?: string | null;
  email?: string | null;
  firstName?: string | null;
  state?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
}

export interface CapiEvent {
  eventName: "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Lead" | "Contact" | "Purchase";
  eventId: string;
  eventSourceUrl?: string;
  user: CapiUserData;
  customData?: Record<string, unknown>;
  eventTime?: number;
}

function userData(u: CapiUserData) {
  return {
    ph: u.phoneE164 ? [sha256(u.phoneE164.replace(/\D/g, ""))] : undefined,
    em: u.email ? [sha256(u.email)] : undefined,
    fn: u.firstName ? [sha256(u.firstName)] : undefined,
    st: u.state ? [sha256(u.state.replace(/\s+/g, ""))] : undefined,
    country: [sha256("ng")],
    client_ip_address: u.clientIp ?? undefined,
    client_user_agent: u.userAgent ?? undefined,
    fbc: u.fbc ?? undefined,
    fbp: u.fbp ?? undefined,
  };
}

/** Sends to Meta when configured; otherwise returns "skipped". Never throws. */
export async function sendCapiEvent(e: CapiEvent): Promise<"sent" | "skipped" | "failed"> {
  if (!services.metaCapi) return "skipped";
  try {
    const body = {
      data: [
        {
          event_name: e.eventName,
          event_time: e.eventTime ?? Math.floor(Date.now() / 1000),
          event_id: e.eventId,
          action_source: "website",
          event_source_url: e.eventSourceUrl,
          user_data: userData(e.user),
          custom_data: e.customData,
        },
      ],
      ...(env.metaTestEventCode ? { test_event_code: env.metaTestEventCode } : {}),
    };
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${env.metaPixelId}/events?access_token=${encodeURIComponent(env.metaCapiToken)}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

/**
 * Flushes queued server-side events (Purchase) from meta_events. Called after staff actions
 * and by the cron route. Mock mode marks them "skipped" so tests can assert exactly one row.
 */
export async function flushMetaEvents(limit = 20): Promise<number> {
  const rows = await asService((q) =>
    q.query<{
      id: string;
      event_name: string;
      event_id: string;
      payload: { value_kobo: number; order_number: string };
      phone_e164: string | null;
      email: string | null;
      customer_name: string | null;
      state: string | null;
      fbc: string | null;
      fbp: string | null;
      user_agent: string | null;
    }>(
      `select m.id, m.event_name, m.event_id, m.payload, o.phone_e164, o.email, o.customer_name, o.state, o.fbc, o.fbp, o.user_agent
         from public.meta_events m left join public.orders o on o.id = m.order_id
        where m.status = 'pending' order by m.created_at limit $1`,
      [limit],
    ),
  );
  for (const r of rows) {
    const status = await sendCapiEvent({
      eventName: r.event_name as CapiEvent["eventName"],
      eventId: r.event_id,
      user: {
        phoneE164: r.phone_e164,
        email: r.email,
        firstName: r.customer_name?.split(" ")[0],
        state: r.state,
        fbc: r.fbc,
        fbp: r.fbp,
        userAgent: r.user_agent,
      },
      customData: {
        currency: "NGN",
        value: Math.round(r.payload.value_kobo) / 100,
        order_id: r.payload.order_number,
      },
    });
    await asService((q) =>
      q.query(
        `update public.meta_events set status = $2, attempts = attempts + 1, sent_at = case when $2 = 'sent' then now() end
          where id = $1`,
        [r.id, status],
      ),
    );
  }
  return rows.length;
}
