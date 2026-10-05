import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/admin-orders";
import { PAYMENT_STATUS_LABEL, type PaymentStatus } from "@/lib/payments/status";

const ORDER_TONE: Record<OrderStatus, "gold" | "navy" | "emeraldSoft" | "emerald" | "redSoft" | "neutral" | "muted"> = {
  awaiting_chat: "gold",
  in_chat: "muted",
  confirmed: "navy",
  dispatched: "emeraldSoft",
  delivered: "emerald",
  failed_delivery: "redSoft",
  returned: "neutral",
  cancelled: "neutral",
};

const PAYMENT_TONE: Record<PaymentStatus, "redSoft" | "gold" | "emerald" | "emeraldSoft" | "muted" | "neutral"> = {
  unpaid: "redSoft",
  payment_claimed: "gold",
  paid: "emerald",
  pay_on_delivery: "emeraldSoft",
  part_paid: "muted",
  refunded: "neutral",
};

export function OrderStatusBadge({ status }: { status: string }) {
  const s = status as OrderStatus;
  return (
    <Badge tone={ORDER_TONE[s] ?? "neutral"} size="pill" data-testid="order-status">
      {ORDER_STATUS_LABEL[s] ?? status}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const s = status as PaymentStatus;
  return (
    <Badge tone={PAYMENT_TONE[s] ?? "neutral"} size="pill" data-testid="payment-status">
      {PAYMENT_STATUS_LABEL[s] ?? status}
    </Badge>
  );
}
