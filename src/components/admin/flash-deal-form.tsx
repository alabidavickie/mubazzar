"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { saveFlashDealAction, type FlashDealResult } from "@/app/actions/admin-flash-deals";
import type { FlashDealInput } from "@/lib/schemas/flash-deal";
import { cn } from "@/lib/cn";

export function FlashDealForm({ initial, products, submitLabel }: { initial: FlashDealInput; products: { id: string; name: string; price: string }[]; submitLabel: string }) {
  const router = useRouter();
  const [v, setV] = useState<FlashDealInput>(initial);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FlashDealResult | null>(null);
  const set = <K extends keyof FlashDealInput>(k: K, val: FlashDealInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) => (result && !result.ok ? result.fieldErrors?.[k] : undefined);
  const product = products.find((p) => p.id === v.productId);
  return (
    <form
      className="flex flex-col gap-2"
      data-testid="flash-deal-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveFlashDealAction(v);
          setResult(r);
          if (r.ok) {
            if (!initial.id) setV(initial);
            router.refresh();
          }
        });
      }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Product" required error={err("productId")}>
          {({ id }) => (
            <Select id={id} value={v.productId} onChange={(e) => set("productId", e.target.value)}>
              <option value="" disabled>
                Choose a product
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.price})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Deal price (₦)" required error={err("dealPrice")} hint={product ? `Regular price ${product.price}` : undefined}>
          {({ id, describedBy }) => <Input id={id} inputMode="decimal" value={v.dealPrice} aria-describedby={describedBy} onChange={(e) => set("dealPrice", e.target.value)} />}
        </Field>
        <Field label="Promo line" hint="e.g. + FREE Extra HEPA Filter">
          {({ id, describedBy }) => <Input id={id} value={v.promoText ?? ""} aria-describedby={describedBy} onChange={(e) => set("promoText", e.target.value)} />}
        </Field>
        <Field label="Starts (Lagos time)" required error={err("startsAt")}>
          {({ id }) => <Input id={id} type="datetime-local" value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} className="py-2" />}
        </Field>
        <Field label="Ends (Lagos time)" required error={err("endsAt")}>
          {({ id }) => <Input id={id} type="datetime-local" value={v.endsAt} onChange={(e) => set("endsAt", e.target.value)} className="py-2" />}
        </Field>
        <label className="flex min-h-11 items-center gap-2 self-end text-label-md">
          <input type="checkbox" checked={v.isActive ?? true} onChange={(e) => set("isActive", e.target.checked)} className="size-5 accent-navy" /> Active
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {result ? (
          <p role={result.ok ? "status" : "alert"} className={cn("text-label-md", result.ok ? "text-emerald-ink" : "text-urgent-ink")}>
            {result.ok ? result.message : result.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
