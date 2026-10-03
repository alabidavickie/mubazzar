import "server-only";
import { asService, parseAppError } from "../db";
import { hashIp, rateLimit } from "../adapters/rate-limit";
import { notify } from "../adapters/notify";
import { sendCapiEvent } from "../adapters/meta";
import { getEnabledChannels, getPrivateSetting } from "./settings";
import { orderSubmissionSchema, type OrderSubmissionInput } from "@/lib/schemas/order";
import { normalizeNgPhone } from "@/lib/phone";
import { generateOrderNumber } from "@/lib/order-number";
import { findDuplicateOrder } from "@/lib/duplicates";
import { pickWhatsAppChannel, buildChannelLink, type ChatChannel, type ChatChannelKind, type WhatsAppRouting } from "@/lib/chat/links";
import { buildCustomerOrderMessage, buildMessage, type OrderMessageData, type TemplateSet } from "@/lib/chat/templates";
import { formatNaira } from "@/lib/money";

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
  userId?: string | null;
  url?: string | null;
}

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; publicToken: string; totalKobo: number; existing: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; code?: string };

const ERROR_COPY: Record<string, string> = {
  EMPTY_ORDER: "Your order is empty. Please choose a package.",
  INVALID_STATE: "Please choose a valid delivery state.",
  PRODUCT_UNAVAILABLE: "This product is no longer available.",
  BUNDLE_UNAVAILABLE: "That package is no longer available. Please pick another.",
  INVALID_QUANTITY: "Please choose a quantity between 1 and 20.",
  TOO_MANY_ITEMS: "Too many items in one order. Please split it into two orders.",
};

export async function placeOrder(raw: OrderSubmissionInput | unknown, ctx: RequestContext): Promise<PlaceOrderResult> {
  const parsed = orderSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    if (fieldErrors.website !== undefined) {
      // Honeypot tripped: respond vaguely so bots learn nothing.
      return { ok: false, error: "We couldn't place this order. Please try again.", code: "REJECTED" };
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;
  const phone = normalizeNgPhone(input.phone);
  if (!phone.ok) return { ok: false, error: phone.error, fieldErrors: { phone: phone.error } };
  const alt = input.altPhone ? normalizeNgPhone(input.altPhone) : null;
  const altE164 = alt && alt.ok ? alt.e164 : null;

  // Rate limits: per IP and per phone.
  const ipHash = hashIp(ctx.ip);
  const [byIp, byPhone] = await Promise.all([
    rateLimit(`order:ip:${ipHash}`, 10, 600),
    rateLimit(`order:phone:${phone.e164}`, 5, 3600),
  ]);
  if (!byIp.ok || !byPhone.ok) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      error: "Too many orders in a short time. Please wait a few minutes or chat with us on WhatsApp.",
    };
  }

  // Duplicate detection (flag, don't block — staff confirm on WhatsApp).
  const recent = await asService((q) =>
    q.query<{ id: string; phoneE164: string; createdAt: string; status: string }>(
      `select id, phone_e164 as "phoneE164", created_at as "createdAt", status from public.orders
        where phone_e164 = $1 and created_at > now() - interval '24 hours' and idempotency_key is distinct from $2`,
      [phone.e164, input.idempotencyKey],
    ),
  );
  const duplicate = findDuplicateOrder(recent, phone.e164);

  // Chat routing: chosen channel if enabled, else WhatsApp.
  const channels = await getEnabledChannels();
  const zoneHub = await asService((q) =>
    q.query<{ hub_code: string }>("select hub_code from public.delivery_zones where state = $1", [input.state]),
  );
  const routing = await getPrivateSetting<WhatsAppRouting>("whatsapp_routing", "by_hub");
  const chosen = resolveChannel(channels, input.chatChannel, {
    routing,
    hubCode: zoneHub[0]?.hub_code ?? null,
    seed: input.idempotencyKey,
  });

  const base = {
    idempotency_key: input.idempotencyKey,
    user_id: ctx.userId ?? null,
    source: input.source,
    landing_page_id: input.landingPageId ?? null,
    customer_name: input.customerName,
    phone_e164: phone.e164,
    alt_phone_e164: altE164,
    state: input.state,
    city: input.city,
    address: input.address,
    landmark: input.landmark || null,
    customer_note: input.note || null,
    chat_channel: chosen?.kind ?? "whatsapp",
    chat_channel_id: chosen?.id ?? null,
    chat_number: chosen?.handle ?? null,
    duplicate_of: duplicate?.id ?? null,
    ...input.attribution,
    client_ip_hash: ipHash,
    user_agent: ctx.userAgent?.slice(0, 500) ?? null,
    items: input.items.map((i) => ({ product_id: i.productId, bundle_id: i.bundleId ?? null, packs: i.packs })),
  };

  let created: { id: string; order_number: string; public_token: string; total_kobo: number; existing: boolean } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    try {
      const rows = await asService((q) =>
        q.query<{ r: typeof created }>("select public.create_order($1::jsonb) as r", [
          { ...base, order_number: generateOrderNumber() },
        ]),
      );
      created = rows[0]?.r ?? null;
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (/orders_order_number_key|duplicate key.*order_number/i.test(msg)) continue; // retry with a new number
      const app = parseAppError(err);
      if (app?.appCode === "OUT_OF_STOCK") {
        return {
          ok: false,
          code: "OUT_OF_STOCK",
          error: `Sorry — ${app.arg ?? "this item"} just sold out for that quantity. Choose a smaller package or chat with us on WhatsApp for restock dates.`,
        };
      }
      if (app && ERROR_COPY[app.appCode]) return { ok: false, code: app.appCode, error: ERROR_COPY[app.appCode]! };
      console.error("[placeOrder] create_order failed", err);
      return { ok: false, code: "SERVER_ERROR", error: "Something went wrong saving your order. Please try again." };
    }
  }
  if (!created) return { ok: false, code: "SERVER_ERROR", error: "Please try again." };

  if (!created.existing) {
    // Fire-and-forget side effects; failures never block the customer.
    void afterOrderCreated(created.id, input.eventId ?? `lead-${created.id}`, ctx).catch((e) =>
      console.error("[placeOrder] post-create side effects failed", e),
    );
  }
  return {
    ok: true,
    orderNumber: created.order_number,
    publicToken: created.public_token,
    totalKobo: created.total_kobo,
    existing: created.existing,
  };
}

function resolveChannel(
  channels: ChatChannel[],
  wanted: ChatChannelKind,
  opts: { routing: WhatsAppRouting; hubCode: string | null; seed: string },
): ChatChannel | null {
  if (wanted !== "whatsapp") {
    const c = channels.find((ch) => ch.kind === wanted && ch.isEnabled);
    if (c) return c;
  }
  return pickWhatsAppChannel(channels, opts);
}

async function afterOrderCreated(orderId: string, eventId: string, ctx: RequestContext) {
  const view = await getOrderViewById(orderId);
  if (!view) return;
  await asService((q) =>
    q.query(
      `insert into public.analytics_events (event_name, event_id, order_id, landing_page_id, path, utm_source, utm_medium, utm_campaign, data)
       values ('Lead', $1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        eventId,
        orderId,
        view.landingPageId,
        ctx.url ?? null,
        view.utmSource,
        view.utmMedium,
        view.utmCampaign,
        { total_kobo: view.totalKobo, source: view.source },
      ],
    ),
  );
  const alerts = await getPrivateSetting<{ emails?: string[]; phones?: string[] }>("admin_alerts", {});
  const summary = `New order ${view.orderNumber}: ${view.lines
    .filter((l) => !l.isFreeGift)
    .map((l) => l.bundleLabel ?? `${l.units}x ${l.name}`)
    .join(", ")} — ${formatNaira(view.totalKobo)} to ${view.state}. ${view.isDuplicateSuspect ? "⚠️ Possible duplicate." : ""}`;
  await Promise.all([
    ...(alerts.emails ?? []).map((to) =>
      notify({ channel: "email", to, template: "admin_new_order", subject: `New order ${view.orderNumber}`, body: summary, orderId }),
    ),
    ...(alerts.phones ?? []).map((to) => notify({ channel: "sms", to, template: "admin_new_order", body: summary, orderId })),
    notify({
      channel: "sms",
      to: view.phoneE164,
      template: "customer_order_received",
      body: `MUBAZZAR: we received order ${view.orderNumber} (${formatNaira(view.totalKobo)}). Continue on ${
        view.chatChannel === "whatsapp" ? "WhatsApp" : "chat"
      } to confirm & pay. We never ask for card PINs or OTPs.`,
      orderId,
    }),
    sendCapiEvent({
      eventName: "Lead",
      eventId,
      eventSourceUrl: ctx.url ?? undefined,
      user: {
        phoneE164: view.phoneE164,
        firstName: view.customerName.split(" ")[0],
        state: view.state,
        clientIp: ctx.ip,
        userAgent: ctx.userAgent,
        fbc: view.fbc,
        fbp: view.fbp,
      },
      customData: { currency: "NGN", value: view.totalKobo / 100, order_id: view.orderNumber },
    }),
  ]);
}

// ─── Read model for thank-you / track pages ──────────────────────────────────
export interface OrderLine {
  name: string;
  bundleLabel: string | null;
  shortLabel: string | null;
  packs: number;
  units: number;
  lineTotalKobo: number;
  isFreeGift: boolean;
  imageUrl: string | null;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  publicToken: string;
  status: string;
  paymentStatus: string;
  customerName: string;
  phoneE164: string;
  state: string;
  city: string;
  address: string;
  landmark: string | null;
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
  amountPaidKobo: number;
  sameDay: boolean;
  etaMinDays: number;
  etaMaxDays: number;
  chatChannel: ChatChannelKind;
  chatNumber: string | null;
  chatClickedAt: string | null;
  createdAt: string;
  source: string;
  landingPageId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  fbc: string | null;
  fbp: string | null;
  isDuplicateSuspect: boolean;
  lines: OrderLine[];
}

const VIEW_SELECT = `
  o.id, o.order_number as "orderNumber", o.public_token as "publicToken", o.status, o.payment_status as "paymentStatus",
  o.customer_name as "customerName", o.phone_e164 as "phoneE164", o.state, o.city, o.address, o.landmark,
  o.subtotal_kobo as "subtotalKobo", o.delivery_fee_kobo as "deliveryFeeKobo", o.total_kobo as "totalKobo",
  o.amount_paid_kobo as "amountPaidKobo", o.same_day as "sameDay", o.eta_min_days as "etaMinDays",
  o.eta_max_days as "etaMaxDays", o.chat_channel as "chatChannel", o.chat_number as "chatNumber",
  o.chat_clicked_at as "chatClickedAt", o.created_at as "createdAt", o.source, o.landing_page_id as "landingPageId",
  o.utm_source as "utmSource", o.utm_medium as "utmMedium", o.utm_campaign as "utmCampaign", o.fbc, o.fbp,
  o.is_duplicate_suspect as "isDuplicateSuspect",
  coalesce((select jsonb_agg(jsonb_build_object(
      'name', oi.name, 'bundleLabel', oi.bundle_label, 'shortLabel', b.short_label, 'packs', oi.packs, 'units', oi.units,
      'lineTotalKobo', oi.line_total_kobo, 'isFreeGift', oi.is_free_gift, 'imageUrl', oi.image_url)
      order by oi.is_free_gift, oi.name)
    from public.order_items oi left join public.bundles b on b.id = oi.bundle_id where oi.order_id = o.id), '[]'::jsonb) as lines
`;

async function getOrderViewById(id: string): Promise<OrderView | null> {
  const rows = await asService((q) => q.query<OrderView>(`select ${VIEW_SELECT} from public.orders o where o.id = $1`, [id]));
  return rows[0] ?? null;
}

/** Thank-you page access requires the unguessable public token, not just the order number. */
export async function getOrderViewByToken(token: string): Promise<OrderView | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const rows = await asService((q) =>
    q.query<OrderView>(`select ${VIEW_SELECT} from public.orders o where o.public_token = $1`, [token]),
  );
  return rows[0] ?? null;
}

export function toMessageData(o: OrderView): OrderMessageData {
  return {
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    phoneE164: o.phoneE164,
    state: o.state,
    city: o.city,
    address: o.address,
    lines: o.lines.map((l) => ({
      name: l.name,
      bundleLabel: l.shortLabel ?? l.bundleLabel,
      packs: l.packs,
      units: l.units,
      isFreeGift: l.isFreeGift,
    })),
    subtotalKobo: o.subtotalKobo,
    deliveryFeeKobo: o.deliveryFeeKobo,
    totalKobo: o.totalKobo,
  };
}

export interface ChatHandoff {
  message: string;
  primary: { kind: ChatChannelKind; label: string; href: string; prefilled: boolean };
  whatsappHref: string | null;
  others: { kind: ChatChannelKind; label: string; href: string }[];
}

/** Builds the handoff links for an order: the routed channel first, plus every other enabled channel. */
export async function buildHandoff(o: OrderView): Promise<ChatHandoff> {
  const [channels, templates] = await Promise.all([
    getEnabledChannels(),
    getPrivateSetting<TemplateSet>("chat_templates", {}),
  ]);
  const message = buildCustomerOrderMessage(toMessageData(o), templates);
  const routedWa =
    (o.chatChannel === "whatsapp" && o.chatNumber
      ? channels.find((c) => c.kind === "whatsapp" && c.handle === o.chatNumber)
      : null) ?? pickWhatsAppChannel(channels, { routing: "first", seed: o.orderNumber });
  const whatsappHref = routedWa ? buildChannelLink("whatsapp", routedWa.handle, message) : null;

  const chosen =
    o.chatChannel !== "whatsapp" ? channels.find((c) => c.kind === o.chatChannel && c.handle === o.chatNumber) ?? null : null;

  const primary = chosen
    ? { kind: chosen.kind, label: chosen.label, href: buildChannelLink(chosen.kind, chosen.handle, null), prefilled: false }
    : { kind: "whatsapp" as const, label: "WhatsApp", href: whatsappHref ?? "#", prefilled: true };

  const others = channels
    .filter((c) => c.kind !== "whatsapp" && c.id !== chosen?.id)
    .map((c) => ({ kind: c.kind, label: c.label, href: buildChannelLink(c.kind, c.handle, null) }));

  return { message, primary, whatsappHref, others };
}

export function staffMessages(o: OrderView, templates: TemplateSet = {}) {
  const data = toMessageData(o);
  return {
    greeting: buildMessage("staff_greeting", data, templates),
    confirmation: buildMessage("staff_confirmation", data, templates),
    dispatch: buildMessage("dispatch_contact", data, templates),
  };
}

export async function logChatClick(publicToken: string, channel: ChatChannelKind): Promise<void> {
  const rows = await asService((q) =>
    q.query<{ r: { ok: boolean; order_id?: string } }>("select public.log_chat_click($1, $2::public.chat_channel_kind) as r", [
      publicToken,
      channel,
    ]),
  );
  const orderId = rows[0]?.r?.order_id;
  if (orderId) {
    await asService((q) =>
      q.query("insert into public.analytics_events (event_name, order_id, data) values ('Contact', $1, $2)", [
        orderId,
        { channel },
      ]),
    );
  }
}

export async function claimPayment(publicToken: string): Promise<boolean> {
  const rows = await asService((q) =>
    q.query<{ r: { claimed: boolean } }>("select public.claim_payment($1) as r", [publicToken]),
  );
  return rows[0]?.r?.claimed ?? false;
}
