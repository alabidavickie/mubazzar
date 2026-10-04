import { formatNaira } from "./money";
import { LAGOS_OFFSET_MINUTES } from "./time";

/** Pure helpers for the staff order desk (/admin/orders). */

export const ORDER_STATUSES = [
  "awaiting_chat",
  "in_chat",
  "confirmed",
  "dispatched",
  "delivered",
  "failed_delivery",
  "returned",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "payment_claimed", "paid", "pay_on_delivery", "part_paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["bank_transfer", "pay_on_delivery", "pos_on_delivery", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_chat: "Awaiting chat",
  in_chat: "In chat",
  confirmed: "Confirmed",
  dispatched: "Dispatched",
  delivered: "Delivered",
  failed_delivery: "Failed delivery",
  returned: "Returned",
  cancelled: "Cancelled",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  pay_on_delivery: "Cash on delivery",
  pos_on_delivery: "POS on delivery",
  other: "Other",
};

/** Mirrors public.order_transition_allowed(). `delivered` only via complete_delivery (dispatch flow). */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  awaiting_chat: ["in_chat", "confirmed", "cancelled"],
  in_chat: ["awaiting_chat", "confirmed", "cancelled"],
  confirmed: ["in_chat", "dispatched", "cancelled"],
  dispatched: ["delivered", "failed_delivery", "confirmed"],
  failed_delivery: ["confirmed", "cancelled", "returned"],
  delivered: ["returned"],
  returned: [],
  cancelled: [],
};

export function allowedTransitions(from: string): OrderStatus[] {
  return TRANSITIONS[from as OrderStatus] ?? [];
}

/**
 * Status buttons staff can press directly: everything allowed except `delivered` (needs the delivery
 * form: collection + proof) and `dispatched` (happens by assigning a dispatcher).
 */
export function staffStatusActions(from: string): OrderStatus[] {
  return allowedTransitions(from).filter((s) => s !== "delivered" && s !== "dispatched");
}

export type OrderView = "all" | "attention" | "follow_up";

export interface OrderFilters {
  view: OrderView;
  status: OrderStatus | null;
  payment: PaymentStatus | null;
  state: string | null;
  from: string | null; // YYYY-MM-DD (Africa/Lagos)
  to: string | null;
  q: string | null;
  page: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null;

export function parseOrderFilters(sp: Record<string, string | string[] | undefined>): OrderFilters {
  const view = one(sp.view);
  const status = one(sp.status);
  const payment = one(sp.payment);
  const from = one(sp.from);
  const to = one(sp.to);
  const page = Number.parseInt(one(sp.page) ?? "1", 10);
  return {
    view: view === "attention" || view === "follow_up" ? view : "all",
    status: (ORDER_STATUSES as readonly string[]).includes(status ?? "") ? (status as OrderStatus) : null,
    payment: (PAYMENT_STATUSES as readonly string[]).includes(payment ?? "") ? (payment as PaymentStatus) : null,
    state: one(sp.state)?.slice(0, 40) ?? null,
    from: from && DATE_RE.test(from) ? from : null,
    to: to && DATE_RE.test(to) ? to : null,
    q: one(sp.q)?.slice(0, 80) ?? null,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

/** Query string for a filter set (omits defaults), e.g. for CSV export links and pagination. */
export function orderFiltersQuery(f: Partial<OrderFilters>): string {
  const p = new URLSearchParams();
  if (f.view && f.view !== "all") p.set("view", f.view);
  if (f.status) p.set("status", f.status);
  if (f.payment) p.set("payment", f.payment);
  if (f.state) p.set("state", f.state);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.q) p.set("q", f.q);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** 00:00 Africa/Lagos on a YYYY-MM-DD date, as a UTC instant. `endOfDay` gives the next midnight. */
export function lagosDayStartUtc(date: string, endOfDay = false): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const utcMidnight = Date.UTC(y, m - 1, d + (endOfDay ? 1 : 0));
  return new Date(utcMidnight - LAGOS_OFFSET_MINUTES * 60_000);
}

/** When an unpaid order still awaiting chat will be auto-cancelled. */
export function autoCancelAt(createdAt: string | Date, autoCancelHours: number): Date {
  return new Date(new Date(createdAt).getTime() + autoCancelHours * 3_600_000);
}

/** RFC 4180 CSV with formula-injection protection (cells starting with = + - @ are prefixed with '). */
export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (v: string | number | boolean | null | undefined) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** One-line description of an order_events row for the staff timeline. */
export function describeOrderEvent(e: { kind: string; fromStatus: string | null; toStatus: string | null; data: Record<string, unknown> }): string {
  const status = (s: string | null) => (s ? (ORDER_STATUS_LABEL[s as OrderStatus] ?? s) : "");
  const naira = (k: unknown) => (typeof k === "number" && Number.isSafeInteger(k) ? formatNaira(k) : "");
  switch (e.kind) {
    case "created":
      return "Order placed";
    case "status_changed":
      return `Status: ${status(e.fromStatus)} → ${status(e.toStatus)}`;
    case "payment_recorded":
      return `Payment recorded: ${naira(e.data.amount_kobo)} (${PAYMENT_METHOD_LABEL[e.data.method as PaymentMethod] ?? e.data.method})`;
    case "refund_recorded":
      return `Refund recorded: ${naira(e.data.amount_kobo)}`;
    case "payment_flag":
      return e.data.flag === "pay_on_delivery" ? "Pay on delivery agreed" : e.data.flag === "payment_claimed" ? "Customer says they paid" : "Payment flag reset to unpaid";
    case "payment_claimed":
      return "Customer says they paid";
    case "note":
      return "Note";
    case "assigned":
      return "Dispatcher assigned";
    case "chat_clicked":
      return `Customer opened ${String(e.data.channel ?? "chat")}`;
    case "duplicate_flagged":
      return "Flagged as possible duplicate";
    case "auto_cancelled":
      return "Auto-cancelled (unpaid, no chat)";
    case "delivery_completed":
      return "Delivered";
    case "delivery_failed":
      return "Delivery failed";
    default:
      return e.kind.replace(/_/g, " ");
  }
}
