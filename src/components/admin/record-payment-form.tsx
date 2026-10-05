"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/icons/icon";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from "@/lib/admin-orders";
import { formatNaira, koboToNairaInput } from "@/lib/money";
import { recordPaymentAction } from "@/app/actions/admin-orders";
import { ActionMessage, useAction } from "./use-action";

/**
 * Record a verified payment (or refund). Partial payments are fine — payment status is recomputed
 * from all records. Bank transfers require ticking that the money actually arrived.
 */
export function RecordPaymentForm({ orderId, balanceKobo, overpaidKobo }: { orderId: string; balanceKobo: number; overpaidKobo: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, result, run } = useAction();
  const [kind, setKind] = useState<"payment" | "refund">(overpaidKobo > 0 ? "refund" : "payment");
  const [method, setMethod] = useState<string>("bank_transfer");
  const err = (k: string) => (result && !result.ok ? result.fieldErrors?.[k] : undefined);
  const suggested = kind === "refund" ? overpaidKobo : balanceKobo;

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-3"
      data-testid="record-payment"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => recordPaymentAction(fd), () => formRef.current?.reset());
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="kind" value={kind} />
      <div role="radiogroup" aria-label="Record a" className="flex gap-2">
        {(["payment", "refund"] as const).map((k) => (
          <label key={k} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-surface-high px-3 text-label-md has-checked:bg-navy has-checked:text-on-dark">
            <input type="radio" name="kind-choice" value={k} checked={kind === k} onChange={() => setKind(k)} className="accent-gold" />
            {k === "payment" ? "Payment received" : "Refund sent"}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Amount (₦)" required error={err("amount")} hint={suggested > 0 ? `${kind === "refund" ? "Overpaid" : "Balance"}: ${formatNaira(suggested)}` : undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={suggested > 0 ? koboToNairaInput(suggested) : ""}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required
            />
          )}
        </Field>
        <Field label="Method" required error={err("method")}>
          {({ id }) => (
            <Select id={id} name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Bank reference / session ID" hint="From the bank alert or app (helps reconcile later)">
        {({ id, describedBy }) => <Input id={id} name="reference" aria-describedby={describedBy} autoComplete="off" />}
      </Field>
      <Field label="Note">{({ id }) => <Textarea id={id} name="note" rows={2} />}</Field>
      <Field label="Proof screenshot (optional)" error={err("proof")} hint="JPG, PNG or WebP, up to 5MB. Stored privately.">
        {({ id, describedBy }) => <Input id={id} name="proof" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={describedBy} className="py-2" />}
      </Field>
      {kind === "payment" && method === "bank_transfer" ? (
        <label className="flex items-start gap-2 rounded-lg bg-gold-soft/30 p-3 text-label-md text-bronze-ink">
          <input type="checkbox" name="verified" className="mt-0.5 size-5 shrink-0 accent-navy" />
          <span>
            <span className="flex items-center gap-1 font-bold">
              <Icon name="warning" className="text-base" /> I checked our bank app — the money has arrived.
            </span>
            Fake transfer screenshots are common. Never mark an order paid from a screenshot alone.
          </span>
        </label>
      ) : null}
      {err("verified") ? (
        <p role="alert" className="text-body-sm font-semibold text-urgent">
          {err("verified")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} variant={kind === "refund" ? "outline" : "primary"}>
        <Icon name="payments" /> {pending ? "Saving…" : kind === "refund" ? "Record refund" : "Record payment"}
      </Button>
      <ActionMessage result={result} />
    </form>
  );
}
