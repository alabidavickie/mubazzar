import type { Kobo } from "../money";

/** Mirrors public.compute_payment_status() in SQL. Keep the two in sync (tests cross-check them). */
export type PaymentStatus =
  | "unpaid"
  | "payment_claimed"
  | "paid"
  | "pay_on_delivery"
  | "part_paid"
  | "refunded";

export interface PaymentRecord {
  kind: "payment" | "refund";
  amountKobo: Kobo;
}

export interface PaymentSummary {
  status: PaymentStatus;
  paidKobo: Kobo;
  refundedKobo: Kobo;
  netKobo: Kobo;
  balanceKobo: Kobo;
  overpaidKobo: Kobo;
  isOverpaid: boolean;
}

export function computePaymentStatus(
  totalKobo: Kobo,
  payments: PaymentRecord[],
  opts: { podAgreed?: boolean; current?: PaymentStatus } = {},
): PaymentSummary {
  const paidKobo = payments.filter((p) => p.kind === "payment").reduce((s, p) => s + p.amountKobo, 0);
  const refundedKobo = payments.filter((p) => p.kind === "refund").reduce((s, p) => s + p.amountKobo, 0);
  const netKobo = paidKobo - refundedKobo;

  let status: PaymentStatus;
  if (refundedKobo > 0 && netKobo <= 0) status = "refunded";
  else if (netKobo >= totalKobo && totalKobo > 0) status = "paid";
  else if (netKobo > 0) status = "part_paid";
  else if (opts.podAgreed) status = "pay_on_delivery";
  else if (opts.current === "payment_claimed") status = "payment_claimed";
  else status = "unpaid";

  return {
    status,
    paidKobo,
    refundedKobo,
    netKobo,
    balanceKobo: Math.max(totalKobo - netKobo, 0),
    overpaidKobo: Math.max(netKobo - totalKobo, 0),
    isOverpaid: netKobo > totalKobo,
  };
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  payment_claimed: "Customer says paid",
  paid: "Paid (verified)",
  pay_on_delivery: "Pay on delivery",
  part_paid: "Part paid",
  refunded: "Refunded",
};
