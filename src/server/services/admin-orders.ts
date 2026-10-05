import "server-only";
import { asUser } from "../db";
import type { SqlParam } from "../db/types-core";
import type { Session } from "../session";
import { getPrivateSetting } from "./settings";
import { staffMessages, type OrderView } from "./orders";
import { lagosDayStartUtc, type OrderFilters } from "@/lib/admin-orders";
import { buildWhatsAppLink } from "@/lib/chat/links";
import type { TemplateSet } from "@/lib/chat/templates";
import { privateObjectUrl } from "../adapters/storage";

/** Staff order desk read models. Every query runs as the signed-in staff member (RLS applies). */

export const ORDERS_PAGE_SIZE = 25;

export interface OrderListRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  customerName: string;
  phoneE164: string;
  state: string;
  city: string;
  totalKobo: number;
  amountPaidKobo: number;
  isOverpaid: boolean;
  isDuplicateSuspect: boolean;
  chatChannel: string;
  chatClickedAt: string | null;
  source: string;
  utmCampaign: string | null;
  createdAt: string;
  itemsSummary: string;
  dispatcherName: string | null;
}

interface Built {
  where: string;
  params: SqlParam[];
}

async function followUpHours(): Promise<number> {
  return Number(await getPrivateSetting<number>("follow_up_after_hours", 12)) || 12;
}

export async function autoCancelHours(): Promise<number> {
  return Number(await getPrivateSetting<number>("auto_cancel_hours", 48)) || 48;
}

async function buildWhere(f: OrderFilters): Promise<Built> {
  const clauses: string[] = [];
  const params: SqlParam[] = [];
  const add = (sql: string, ...values: SqlParam[]) => {
    let s = sql;
    for (const v of values) {
      params.push(v);
      s = s.replace("?", `$${params.length}`);
    }
    clauses.push(s);
  };
  if (f.view === "attention") clauses.push("(o.status = 'awaiting_chat' or o.payment_status = 'payment_claimed')");
  if (f.view === "follow_up") {
    add(
      "o.status = 'awaiting_chat' and o.payment_status = 'unpaid' and o.created_at < now() - make_interval(hours => ?)",
      await followUpHours(),
    );
  }
  if (f.status) add("o.status = ?::public.order_status", f.status);
  if (f.payment) add("o.payment_status = ?::public.payment_status", f.payment);
  if (f.state) add("o.state = ?", f.state);
  if (f.from) add("o.created_at >= ?", lagosDayStartUtc(f.from));
  if (f.to) add("o.created_at < ?", lagosDayStartUtc(f.to, true));
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    const like = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    if (digits.length >= 7) add("(o.order_number ilike ? or o.customer_name ilike ? or o.phone_e164 like ?)", like, like, `%${digits.slice(-10)}%`);
    else add("(o.order_number ilike ? or o.customer_name ilike ?)", like, like);
  }
  return { where: clauses.length ? `where ${clauses.join(" and ")}` : "", params };
}

const LIST_SELECT = `
  o.id, o.order_number as "orderNumber", o.status, o.payment_status as "paymentStatus", o.customer_name as "customerName",
  o.phone_e164 as "phoneE164", o.state, o.city, o.total_kobo as "totalKobo", o.amount_paid_kobo as "amountPaidKobo",
  o.is_overpaid as "isOverpaid", o.is_duplicate_suspect as "isDuplicateSuspect", o.chat_channel as "chatChannel",
  o.chat_clicked_at as "chatClickedAt", o.source, o.utm_campaign as "utmCampaign", o.created_at as "createdAt",
  coalesce((select string_agg(oi.packs || 'x ' || coalesce(oi.bundle_label, oi.name), ', ' order by oi.is_free_gift, oi.name)
              from public.order_items oi where oi.order_id = o.id and not oi.is_free_gift), '') as "itemsSummary",
  (select p.full_name from public.dispatch_assignments da join public.profiles p on p.id = da.dispatcher_id
    where da.order_id = o.id order by da.assigned_at desc limit 1) as "dispatcherName"`;

export async function listOrders(
  session: Session,
  f: OrderFilters,
): Promise<{ rows: OrderListRow[]; total: number; counts: Record<string, number>; followUpHours: number; autoCancelHours: number }> {
  const { where, params } = await buildWhere(f);
  const offset = (f.page - 1) * ORDERS_PAGE_SIZE;
  const fu = await followUpHours();
  const [rows, total, counts, ac] = await Promise.all([
    asUser(session.userId, (q) =>
      q.query<OrderListRow>(
        `select ${LIST_SELECT} from public.orders o ${where} order by o.created_at desc limit ${ORDERS_PAGE_SIZE} offset ${offset}`,
        params,
      ),
    ),
    asUser(session.userId, (q) => q.query<{ n: number }>(`select count(*)::int as n from public.orders o ${where}`, params)),
    asUser(session.userId, (q) =>
      q.query<{ key: string; n: number }>(
        `select 'attention' as key, count(*)::int as n from public.orders where status = 'awaiting_chat' or payment_status = 'payment_claimed'
         union all
         select 'follow_up', count(*)::int from public.orders
          where status = 'awaiting_chat' and payment_status = 'unpaid' and created_at < now() - make_interval(hours => $1)`,
        [fu],
      ),
    ),
    autoCancelHours(),
  ]);
  return {
    rows,
    total: total[0]?.n ?? 0,
    counts: Object.fromEntries(counts.map((c) => [c.key, c.n])),
    followUpHours: fu,
    autoCancelHours: ac,
  };
}

/** Rows for CSV export (same filters, no paging, capped). */
export async function exportOrders(session: Session, f: OrderFilters) {
  const { where, params } = await buildWhere(f);
  return asUser(session.userId, (q) =>
    q.query<OrderListRow & { address: string; landmark: string | null; subtotalKobo: number; deliveryFeeKobo: number; utmSource: string | null }>(
      `select ${LIST_SELECT}, o.address, o.landmark, o.subtotal_kobo as "subtotalKobo", o.delivery_fee_kobo as "deliveryFeeKobo",
              o.utm_source as "utmSource"
         from public.orders o ${where} order by o.created_at desc limit 5000`,
      params,
    ),
  );
}

export interface PaymentRow {
  id: string;
  kind: "payment" | "refund";
  amountKobo: number;
  method: string;
  reference: string | null;
  note: string | null;
  proofUrl: string | null;
  recordedByName: string | null;
  recordedByRole: string;
  createdAt: string;
}

export interface EventRow {
  id: number;
  kind: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  data: Record<string, unknown>;
  actorRole: string;
  actorName: string | null;
  createdAt: string;
}

export interface AssignmentRow {
  id: string;
  status: string;
  dispatcherId: string;
  dispatcherName: string | null;
  collectedKobo: number;
  collectedMethod: string | null;
  failureReason: string | null;
  proofUrl: string | null;
  assignedAt: string;
  completedAt: string | null;
}

export interface OrderDetail {
  order: OrderView & {
    altPhoneE164: string | null;
    email: string | null;
    customerNote: string | null;
    isOverpaid: boolean;
    podAgreed: boolean;
    hubName: string;
    fbclid: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    duplicateOf: string | null;
    duplicateOfNumber: string | null;
    paidAt: string | null;
  };
  payments: PaymentRow[];
  events: EventRow[];
  assignments: AssignmentRow[];
  dispatchers: { id: string; name: string; hubCode: string | null }[];
  links: { greeting: string; confirmation: string; call: string };
  bankAccounts: { bank: string; accountName: string; accountNumber: string }[];
  autoCancelAt: string | null;
}

const DETAIL_SELECT = `
  o.id, o.order_number as "orderNumber", o.public_token as "publicToken", o.status, o.payment_status as "paymentStatus",
  o.customer_name as "customerName", o.phone_e164 as "phoneE164", o.alt_phone_e164 as "altPhoneE164", o.email,
  o.state, o.city, o.address, o.landmark, o.customer_note as "customerNote",
  o.subtotal_kobo as "subtotalKobo", o.delivery_fee_kobo as "deliveryFeeKobo", o.total_kobo as "totalKobo",
  o.amount_paid_kobo as "amountPaidKobo", o.is_overpaid as "isOverpaid", o.pod_agreed as "podAgreed",
  o.same_day as "sameDay", o.eta_min_days as "etaMinDays", o.eta_max_days as "etaMaxDays",
  o.chat_channel as "chatChannel", o.chat_number as "chatNumber", o.chat_clicked_at as "chatClickedAt",
  o.created_at as "createdAt", o.paid_at as "paidAt", o.source, o.landing_page_id as "landingPageId",
  o.utm_source as "utmSource", o.utm_medium as "utmMedium", o.utm_campaign as "utmCampaign",
  o.utm_content as "utmContent", o.utm_term as "utmTerm", o.fbclid, o.fbc, o.fbp,
  o.is_duplicate_suspect as "isDuplicateSuspect", o.duplicate_of as "duplicateOf",
  (select d.order_number from public.orders d where d.id = o.duplicate_of) as "duplicateOfNumber",
  h.name as "hubName",
  coalesce((select jsonb_agg(jsonb_build_object(
      'name', oi.name, 'bundleLabel', oi.bundle_label, 'shortLabel', b.short_label, 'packs', oi.packs, 'units', oi.units,
      'lineTotalKobo', oi.line_total_kobo, 'isFreeGift', oi.is_free_gift, 'imageUrl', oi.image_url)
      order by oi.is_free_gift, oi.name)
    from public.order_items oi left join public.bundles b on b.id = oi.bundle_id where oi.order_id = o.id), '[]'::jsonb) as lines`;

export async function getOrderDetail(session: Session, id: string): Promise<OrderDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const data = await asUser(session.userId, async (q) => {
    const orders = await q.query<OrderDetail["order"]>(
      `select ${DETAIL_SELECT} from public.orders o join public.hubs h on h.id = o.hub_id where o.id = $1`,
      [id],
    );
    const order = orders[0];
    if (!order) return null;
    const [payments, events, assignments, dispatchers] = await Promise.all([
      q.query<PaymentRow>(
        `select pm.id, pm.kind, pm.amount_kobo as "amountKobo", pm.method, pm.reference, pm.note, pm.proof_url as "proofUrl",
                p.full_name as "recordedByName", pm.recorded_by_role as "recordedByRole", pm.created_at as "createdAt"
           from public.payments pm left join public.profiles p on p.id = pm.recorded_by
          where pm.order_id = $1 order by pm.created_at`,
        [id],
      ),
      q.query<EventRow>(
        `select e.id, e.kind, e.from_status as "fromStatus", e.to_status as "toStatus", e.note, e.data,
                e.actor_role as "actorRole", p.full_name as "actorName", e.created_at as "createdAt"
           from public.order_events e left join public.profiles p on p.id = e.actor_id
          where e.order_id = $1 order by e.created_at desc, e.id desc`,
        [id],
      ),
      q.query<AssignmentRow>(
        `select da.id, da.status, da.dispatcher_id as "dispatcherId", p.full_name as "dispatcherName",
                da.collected_kobo as "collectedKobo", da.collected_method as "collectedMethod",
                da.failure_reason as "failureReason", da.proof_url as "proofUrl",
                da.assigned_at as "assignedAt", da.completed_at as "completedAt"
           from public.dispatch_assignments da left join public.profiles p on p.id = da.dispatcher_id
          where da.order_id = $1 order by da.assigned_at desc`,
        [id],
      ),
      q.query<{ id: string; name: string; hubCode: string | null }>(
        `select p.id, coalesce(p.full_name, p.email, 'Dispatcher') as name, p.hub_code as "hubCode"
           from public.profiles p where p.role = 'dispatcher' and p.is_active order by p.full_name`,
      ),
    ]);
    return { order, payments, events, assignments, dispatchers };
  });
  if (!data) return null;

  const [templates, bankAccounts, cancelHours] = await Promise.all([
    getPrivateSetting<TemplateSet>("chat_templates", {}),
    getPrivateSetting<OrderDetail["bankAccounts"]>("bank_accounts", []),
    autoCancelHours(),
  ]);
  const msgs = staffMessages(data.order, templates);
  // Proof screenshots/photos live in a private bucket: hand out short-lived URLs only to staff.
  const payments = await Promise.all(
    data.payments.map(async (p) => ({ ...p, proofUrl: p.proofUrl ? await privateObjectUrl(p.proofUrl) : null })),
  );
  const assignments = await Promise.all(
    data.assignments.map(async (a) => ({ ...a, proofUrl: a.proofUrl ? await privateObjectUrl(a.proofUrl) : null })),
  );
  const o = data.order;
  return {
    ...data,
    payments,
    assignments,
    links: {
      greeting: buildWhatsAppLink(o.phoneE164, msgs.greeting),
      confirmation: buildWhatsAppLink(o.phoneE164, msgs.confirmation),
      call: `tel:${o.phoneE164}`,
    },
    bankAccounts: Array.isArray(bankAccounts) ? bankAccounts : [],
    autoCancelAt:
      o.status === "awaiting_chat" && o.paymentStatus === "unpaid"
        ? new Date(new Date(o.createdAt).getTime() + cancelHours * 3_600_000).toISOString()
        : null,
  };
}
