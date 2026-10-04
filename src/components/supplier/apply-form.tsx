"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { applySupplierAction, type SupplierResult } from "@/app/actions/supplier";

export function SupplierApplyForm({ categories }: { categories: { slug: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SupplierResult | null>(null);
  const err = (k: string) => (result && !result.ok ? result.fieldErrors?.[k] : undefined);
  if (result?.ok) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-xl bg-emerald-soft p-4 text-emerald-ink" data-testid="apply-done">
        <p className="text-label-lg font-bold">{result.message}</p>
        <Link href="/login" className="w-fit text-label-md underline">
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card"
      data-testid="supplier-apply"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () =>
          setResult(
            await applySupplierAction({
              businessName: String(fd.get("businessName") ?? ""),
              contactName: String(fd.get("contactName") ?? ""),
              phone: String(fd.get("phone") ?? ""),
              email: String(fd.get("email") ?? ""),
              password: String(fd.get("password") ?? ""),
              cacNumber: String(fd.get("cacNumber") ?? ""),
              categories: fd.getAll("categories").map(String),
              sampleLinks: String(fd.get("sampleLinks") ?? ""),
              message: String(fd.get("message") ?? ""),
              website: String(fd.get("website") ?? ""),
            }),
          ),
        );
      }}
    >
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Business name" required error={err("businessName")}>{({ id, invalid }) => <Input id={id} name="businessName" autoComplete="organization" aria-invalid={invalid} />}</Field>
        <Field label="Your name" required error={err("contactName")}>{({ id, invalid }) => <Input id={id} name="contactName" autoComplete="name" aria-invalid={invalid} />}</Field>
        <Field label="WhatsApp number" required error={err("phone")}>{({ id, invalid }) => <Input id={id} name="phone" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={invalid} />}</Field>
        <Field label="Email" required error={err("email")}>{({ id, invalid }) => <Input id={id} name="email" type="email" autoComplete="email" aria-invalid={invalid} />}</Field>
        <Field label="Create a password" required hint="10+ characters — you'll use it to sign in" error={err("password")}>
          {({ id, describedBy, invalid }) => <Input id={id} name="password" type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={invalid} />}
        </Field>
        <Field label="CAC number (optional)" hint="RC… or BN…; leave empty if registration is in progress" error={err("cacNumber")}>
          {({ id, describedBy, invalid }) => <Input id={id} name="cacNumber" aria-describedby={describedBy} aria-invalid={invalid} />}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-label-md font-semibold text-navy">What do you sell?</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.slug} className="flex min-h-10 items-center gap-1.5 rounded-full bg-surface-high px-3 text-label-md has-checked:bg-navy has-checked:text-on-dark">
              <input type="checkbox" name="categories" value={c.slug} className="accent-gold" /> {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Links to your products (optional)" hint="Instagram, website or marketplace links — separate with spaces or commas" error={err("sampleLinks")}>
        {({ id, describedBy }) => <Input id={id} name="sampleLinks" aria-describedby={describedBy} />}
      </Field>
      <Field label="Tell us about your products" error={err("message")}>{({ id }) => <Textarea id={id} name="message" rows={3} />}</Field>
      {result && !result.ok ? (
        <p role="alert" className="rounded-lg bg-urgent-soft px-3 py-2 text-label-md text-urgent-ink">
          {result.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send application"}
      </Button>
    </form>
  );
}
