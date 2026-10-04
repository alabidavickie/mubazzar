"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/icons/icon";
import { completeDeliveryAction, failDeliveryAction, type DispatchResult } from "@/app/actions/dispatch";
import { koboToNairaInput } from "@/lib/money";

/** Delivered (with money collected + proof photo) or failed (with reason). Big targets for one-handed use. */
export function DeliveryForms({ orderId, balanceKobo }: { orderId: string; balanceKobo: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"delivered" | "failed" | null>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<DispatchResult | null>(null);

  const submit = (action: (fd: FormData) => Promise<DispatchResult>) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await action(fd);
      setResult(r);
      if (r.ok) router.refresh();
    });
  };
  const err = (k: string) => (result && !result.ok ? result.fieldErrors?.[k] : undefined);

  if (result?.ok) {
    return (
      <p role="status" className="rounded-xl bg-emerald-soft p-4 text-label-lg text-emerald-ink" data-testid="delivery-done">
        {result.message}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === null ? (
        <div className="grid grid-cols-2 gap-2">
          <Button size="xl" variant="whatsapp" onClick={() => setMode("delivered")}>
            <Icon name="check_circle" /> Delivered
          </Button>
          <Button size="xl" variant="danger" onClick={() => setMode("failed")}>
            <Icon name="cancel" /> Failed
          </Button>
        </div>
      ) : null}

      {mode === "delivered" ? (
        <form onSubmit={submit(completeDeliveryAction)} className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card" data-testid="delivered-form">
          <input type="hidden" name="orderId" value={orderId} />
          <Field label="Money collected at the door (₦)" hint={balanceKobo > 0 ? "Enter 0 if the customer paid the office directly." : "Order is already paid."} error={err("collected")}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} name="collected" inputMode="decimal" defaultValue={balanceKobo > 0 ? koboToNairaInput(balanceKobo) : "0"} aria-describedby={describedBy} aria-invalid={invalid} />
            )}
          </Field>
          <Field label="How was it paid?" error={err("method")}>
            {({ id }) => (
              <Select id={id} name="method" defaultValue="pay_on_delivery">
                <option value="pay_on_delivery">Cash</option>
                <option value="pos_on_delivery">POS</option>
                <option value="bank_transfer">Transfer to company account</option>
              </Select>
            )}
          </Field>
          <Field label="Proof of delivery photo" hint="Package with the customer or at the door" error={err("proof")}>
            {({ id, describedBy }) => <Input id={id} name="proof" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-describedby={describedBy} className="py-2" />}
          </Field>
          <Field label="Note (optional)">{({ id }) => <Textarea id={id} name="note" rows={2} />}</Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="lg" onClick={() => setMode(null)}>
              Back
            </Button>
            <Button type="submit" variant="whatsapp" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Confirm delivered"}
            </Button>
          </div>
        </form>
      ) : null}

      {mode === "failed" ? (
        <form onSubmit={submit(failDeliveryAction)} className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card" data-testid="failed-form">
          <input type="hidden" name="orderId" value={orderId} />
          <Field label="What happened?" required error={err("reason")}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} name="reason" defaultValue="" aria-describedby={describedBy} aria-invalid={invalid} required>
                <option value="" disabled>
                  Choose a reason
                </option>
                <option>Customer not reachable</option>
                <option>Customer not at the address</option>
                <option>Customer refused the package</option>
                <option>Customer could not pay</option>
                <option>Wrong or incomplete address</option>
                <option>Customer asked to reschedule</option>
              </Select>
            )}
          </Field>
          <Field label="Photo (optional)" error={err("proof")}>
            {({ id }) => <Input id={id} name="proof" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="py-2" />}
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="lg" onClick={() => setMode(null)}>
              Back
            </Button>
            <Button type="submit" variant="danger" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Confirm failed"}
            </Button>
          </div>
        </form>
      ) : null}

      {result && !result.ok ? (
        <p role="alert" className="rounded-lg bg-urgent-soft px-3 py-2 text-label-md text-urgent-ink">
          {result.error}
        </p>
      ) : null}
    </div>
  );
}
