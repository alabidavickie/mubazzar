"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/admin-orders";
import { setOrderStatusAction, setPaymentFlagAction } from "@/app/actions/admin-orders";
import { ActionMessage, useAction } from "./use-action";

const STATUS_VERB: Partial<Record<OrderStatus, string>> = {
  in_chat: "Mark in chat",
  awaiting_chat: "Back to awaiting chat",
  confirmed: "Confirm order",
  cancelled: "Cancel order",
  failed_delivery: "Mark delivery failed",
  returned: "Mark returned",
};

/** Status buttons (only transitions the DB allows) + chat payment flags. */
export function OrderStatusActions({ orderId, actions }: { orderId: string; actions: OrderStatus[] }) {
  const { pending, result, run } = useAction();
  const [note, setNote] = useState("");
  if (actions.length === 0) return <p className="text-body-sm text-ink-muted">No further status changes from here.</p>;
  return (
    <div className="flex flex-col gap-2">
      <Field label="Note for the timeline (optional — required to cancel or fail)">
        {({ id }) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer confirmed on WhatsApp" />}
      </Field>
      <div className="flex flex-wrap gap-2">
        {actions.map((s) => {
          const needsNote = s === "cancelled" || s === "failed_delivery";
          return (
            <Button
              key={s}
              variant={s === "cancelled" || s === "failed_delivery" ? "danger" : s === "confirmed" ? "primary" : "soft"}
              disabled={pending || (needsNote && !note.trim())}
              onClick={() => run(() => setOrderStatusAction({ orderId, status: s, note }), () => setNote(""))}
            >
              {STATUS_VERB[s] ?? ORDER_STATUS_LABEL[s]}
            </Button>
          );
        })}
      </div>
      <ActionMessage result={result} />
    </div>
  );
}

export function PaymentFlagActions({ orderId, paymentStatus, podAgreed }: { orderId: string; paymentStatus: string; podAgreed: boolean }) {
  const { pending, result, run } = useAction();
  const canFlag = paymentStatus === "unpaid" || paymentStatus === "payment_claimed" || paymentStatus === "pay_on_delivery";
  if (!canFlag) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-label-sm text-ink-muted uppercase">What was agreed in chat</p>
      <div className="flex flex-wrap gap-2">
        {paymentStatus !== "payment_claimed" ? (
          <Button size="sm" variant="soft" disabled={pending} onClick={() => run(() => setPaymentFlagAction({ orderId, flag: "payment_claimed" }))}>
            Customer says they paid
          </Button>
        ) : null}
        {!podAgreed ? (
          <Button size="sm" variant="soft" disabled={pending} onClick={() => run(() => setPaymentFlagAction({ orderId, flag: "pay_on_delivery" }))}>
            Pay on delivery agreed
          </Button>
        ) : null}
        {paymentStatus !== "unpaid" || podAgreed ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setPaymentFlagAction({ orderId, flag: "unpaid" }))}>
            Reset to unpaid
          </Button>
        ) : null}
      </div>
      <ActionMessage result={result} />
    </div>
  );
}
