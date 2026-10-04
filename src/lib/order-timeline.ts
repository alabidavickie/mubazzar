/**
 * Customer-facing order status copy + timeline (thank-you and Track Order pages).
 * Pure and isomorphic; mirrors the `order_status` / `payment_status` enums in SQL.
 */
export type OrderStatus =
  | "awaiting_chat"
  | "in_chat"
  | "confirmed"
  | "dispatched"
  | "delivered"
  | "failed_delivery"
  | "returned"
  | "cancelled";

export type CustomerPaymentStatus = "unpaid" | "payment_claimed" | "paid" | "pay_on_delivery" | "part_paid" | "refunded";

export const ORDER_STATUS_CUSTOMER_LABEL: Record<OrderStatus, string> = {
  awaiting_chat: "Order received — waiting for you in chat",
  in_chat: "Chatting with our team",
  confirmed: "Confirmed — preparing your package",
  dispatched: "On the way",
  delivered: "Delivered",
  failed_delivery: "Delivery attempt failed",
  returned: "Returned",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_CUSTOMER_LABEL: Record<CustomerPaymentStatus, string> = {
  unpaid: "Not paid yet — pay in chat",
  payment_claimed: "Payment sent — our team is verifying it",
  paid: "Paid (verified by our team)",
  pay_on_delivery: "Pay on Delivery agreed",
  part_paid: "Part payment received",
  refunded: "Refunded",
};

export interface TimelineEvent {
  kind: string;
  to_status?: string | null;
  created_at: string;
}

export interface TimelineStep {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming" | "problem";
  at: string | null;
}

const HAPPY_PATH: { key: OrderStatus; label: string }[] = [
  { key: "awaiting_chat", label: "Order placed" },
  { key: "in_chat", label: "Confirming in chat" },
  { key: "confirmed", label: "Confirmed" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
];

const TERMINAL_PROBLEM: Partial<Record<OrderStatus, string>> = {
  failed_delivery: "Delivery failed",
  returned: "Returned",
  cancelled: "Cancelled",
};

function isOrderStatus(s: string): s is OrderStatus {
  return s in ORDER_STATUS_CUSTOMER_LABEL;
}

/**
 * Builds the visible timeline. Happy-path steps up to the furthest reached status are "done"
 * (the current one is "current"); a problem status (cancelled / failed / returned) is appended
 * after the last step that actually happened, and nothing after it is shown as upcoming.
 */
export function buildTimeline(status: string, events: TimelineEvent[] = []): TimelineStep[] {
  const reachedAt = new Map<string, string>();
  for (const e of events) {
    const to = e.kind === "created" ? "awaiting_chat" : (e.to_status ?? null);
    if (to && !reachedAt.has(to)) reachedAt.set(to, e.created_at);
  }
  const current: OrderStatus = isOrderStatus(status) ? status : "awaiting_chat";
  const problem = TERMINAL_PROBLEM[current];

  // Furthest happy-path step reached (by current status, or by history for problem statuses).
  let furthest = HAPPY_PATH.findIndex((s) => s.key === current);
  if (furthest < 0) {
    furthest = 0;
    HAPPY_PATH.forEach((s, i) => {
      if (reachedAt.has(s.key)) furthest = i;
    });
    if (current === "returned" || current === "failed_delivery") {
      // A failed/returned order was at least dispatched.
      furthest = Math.max(furthest, HAPPY_PATH.findIndex((s) => s.key === "dispatched"));
    }
  }

  const steps: TimelineStep[] = [];
  HAPPY_PATH.forEach((s, i) => {
    if (problem && i > furthest) return;
    steps.push({
      key: s.key,
      label: s.label,
      state: i < furthest || (problem && i === furthest) ? "done" : i === furthest ? "current" : "upcoming",
      at: reachedAt.get(s.key) ?? null,
    });
  });
  if (problem) steps.push({ key: current, label: problem, state: "problem", at: reachedAt.get(current) ?? null });
  return steps;
}
