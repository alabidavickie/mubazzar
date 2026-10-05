"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/icons/icon";
import { saveSupplierProductAction, uploadSupplierImageAction, type SupplierResult } from "@/app/actions/supplier";
import type { SupplierProductInput } from "@/lib/schemas/supplier";
import { cn } from "@/lib/cn";

export function SupplierProductForm({ initial, categories, editable }: { initial: SupplierProductInput; categories: { id: string; name: string }[]; editable: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SupplierResult | null>(null);
  const set = <K extends keyof SupplierProductInput>(k: K, val: SupplierProductInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) => (result && !result.ok ? result.fieldErrors?.[k] : undefined);
  const images = v.imageUrls ?? [];
  const save = (submit: boolean) =>
    start(async () => {
      const r = await saveSupplierProductAction({ ...v, submit });
      setResult(r);
      if (r.ok) router.push("/supplier");
    });
  return (
    <form className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card" data-testid="supplier-product-form" onSubmit={(e) => e.preventDefault()}>
      <fieldset disabled={!editable} className="flex flex-col gap-3">
        <Field label="Product name" required error={err("name")}>{({ id }) => <Input id={id} value={v.name} onChange={(e) => set("name", e.target.value)} />}</Field>
        <Field label="Description" required hint="What it does, what's in the box, specs" error={err("description")}>
          {({ id, describedBy }) => <Textarea id={id} rows={4} value={v.description} aria-describedby={describedBy} onChange={(e) => set("description", e.target.value)} />}
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Category">
            {({ id }) => (
              <Select id={id} value={v.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)}>
                <option value="">Choose…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Units you can supply now" error={err("stockAvailable")}>
            {({ id }) => <Input id={id} type="number" min={0} value={String(v.stockAvailable)} onChange={(e) => set("stockAvailable", Number(e.target.value))} />}
          </Field>
          <Field label="Proposed selling price (₦)" required error={err("proposedPrice")}>
            {({ id }) => <Input id={id} inputMode="decimal" value={v.proposedPrice ?? ""} onChange={(e) => set("proposedPrice", e.target.value)} />}
          </Field>
          <Field label="Usual market price (₦, optional)" error={err("compareAt")}>
            {({ id }) => <Input id={id} inputMode="decimal" value={v.compareAt ?? ""} onChange={(e) => set("compareAt", e.target.value)} />}
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-label-md font-semibold text-navy">Photos</span>
          {images.length ? (
            <ul className="flex flex-wrap gap-2">
              {images.map((u) => (
                <li key={u} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded thumbnail */}
                  <img src={u} alt="" className="size-20 rounded-lg object-cover" />
                  <button type="button" onClick={() => set("imageUrls", images.filter((x) => x !== u))} className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-urgent text-on-dark" aria-label="Remove photo">
                    <Icon name="close" className="text-sm" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Upload a product photo"
            className="text-body-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.set("file", f);
              const r = await uploadSupplierImageAction(fd);
              if (r.ok && r.url) set("imageUrls", [...images, r.url]);
              setResult(r.ok ? null : r);
              e.target.value = "";
            }}
          />
          {err("imageUrls") ? (
            <p role="alert" className="text-body-sm font-semibold text-urgent">
              {err("imageUrls")}
            </p>
          ) : null}
        </div>
      </fieldset>
      {result && !result.ok ? (
        <p role="alert" className={cn("rounded-lg bg-urgent-soft px-3 py-2 text-label-md text-urgent-ink")}>
          {result.error}
        </p>
      ) : null}
      {editable ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" disabled={pending} onClick={() => save(false)}>
            Save draft
          </Button>
          <Button disabled={pending} onClick={() => save(true)}>
            Send for review
          </Button>
        </div>
      ) : null}
    </form>
  );
}
