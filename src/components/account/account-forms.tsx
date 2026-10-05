"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/icons/icon";
import {
  deleteAddressAction,
  isWishlistedAction,
  saveAddressAction,
  submitReviewAction,
  toggleWishlistAction,
  type AccountResult,
} from "@/app/actions/account";
import { cn } from "@/lib/cn";

function Msg({ r }: { r: AccountResult | null }) {
  if (!r) return null;
  return (
    <p role={r.ok ? "status" : "alert"} className={cn("text-label-sm", r.ok ? "text-emerald-ink" : "text-urgent-ink")}>
      {r.ok ? r.message : r.error}
    </p>
  );
}

export function ReviewForm({ orderId, productId, productName }: { orderId: string; productId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [pending, start] = useTransition();
  const [r, setR] = useState<AccountResult | null>(null);
  if (r?.ok) return <Msg r={r} />;
  if (!open)
    return (
      <Button size="sm" variant="soft" onClick={() => setOpen(true)}>
        <Icon name="rate_review" /> Review {productName}
      </Button>
    );
  return (
    <form
      className="flex flex-col gap-2 rounded-lg bg-surface-low p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setR(await submitReviewAction({ orderId, productId, rating, body: String(fd.get("body") ?? ""), location: String(fd.get("location") ?? "") })));
      }}
    >
      <fieldset>
        <legend className="text-label-md font-semibold text-navy">Your rating for {productName}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex size-11 cursor-pointer items-center justify-center text-2xl">
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
              <span aria-hidden className={n <= rating ? "text-gold" : "text-line"}>
                ★
              </span>
              <span className="sr-only">
                {n} star{n === 1 ? "" : "s"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Your review">{({ id }) => <Textarea id={id} name="body" rows={3} />}</Field>
      <Field label="Your area (optional)" hint="e.g. Lekki Phase 1, Lagos">{({ id, describedBy }) => <Input id={id} name="location" aria-describedby={describedBy} />}</Field>
      <Button type="submit" size="sm" disabled={pending}>
        Send review
      </Button>
      <Msg r={r} />
    </form>
  );
}

export interface AddressValues {
  id?: string | null;
  label: string;
  fullName: string;
  phone: string;
  state: string;
  city: string;
  address: string;
  landmark: string;
  isDefault: boolean;
}

export function AddressForm({ initial, states }: { initial: AddressValues; states: { state: string; displayName: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [r, setR] = useState<AccountResult | null>(null);
  const set = (p: Partial<AddressValues>) => setV((x) => ({ ...x, ...p }));
  const err = (k: string) => (r && !r.ok ? r.fieldErrors?.[k] : undefined);
  return (
    <form
      className="grid grid-cols-1 gap-2 rounded-xl bg-card p-3 shadow-card sm:grid-cols-2"
      data-testid="address-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveAddressAction(v);
          setR(res);
          if (res.ok) {
            if (!initial.id) setV(initial);
            router.refresh();
          }
        });
      }}
    >
      <Field label="Label">{({ id }) => <Input id={id} value={v.label} onChange={(e) => set({ label: e.target.value })} />}</Field>
      <Field label="Recipient name" error={err("fullName")}>{({ id }) => <Input id={id} autoComplete="name" value={v.fullName} onChange={(e) => set({ fullName: e.target.value })} />}</Field>
      <Field label="Phone" error={err("phone")}>{({ id }) => <Input id={id} type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={(e) => set({ phone: e.target.value })} />}</Field>
      <Field label="State" error={err("state")}>
        {({ id }) => (
          <Select id={id} value={v.state} onChange={(e) => set({ state: e.target.value })}>
            <option value="">Choose a state</option>
            {states.map((s) => (
              <option key={s.state} value={s.state}>
                {s.displayName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="LGA / City" error={err("city")}>{({ id }) => <Input id={id} autoComplete="address-level2" value={v.city} onChange={(e) => set({ city: e.target.value })} />}</Field>
      <Field label="Street address" error={err("address")}>{({ id }) => <Input id={id} autoComplete="street-address" value={v.address} onChange={(e) => set({ address: e.target.value })} />}</Field>
      <Field label="Landmark (optional)">{({ id }) => <Input id={id} value={v.landmark} onChange={(e) => set({ landmark: e.target.value })} />}</Field>
      <label className="flex min-h-11 items-center gap-2 self-end text-label-md">
        <input type="checkbox" checked={v.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} className="size-5 accent-navy" /> Use as default
      </label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {initial.id ? "Save" : "Add address"}
        </Button>
        {initial.id ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { setR(await deleteAddressAction({ id: initial.id! })); router.refresh(); })}>
            Remove
          </Button>
        ) : null}
        <Msg r={r} />
      </div>
    </form>
  );
}

/** Heart button: saves to the signed-in customer's wishlist (guests are sent to sign in). */
export function WishlistButton({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!/(?:^|;\s*)mbz_signed_in=1/.test(document.cookie)) return;
    let alive = true;
    isWishlistedAction({ productId }).then((v) => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, [productId]);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        aria-pressed={on}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toggleWishlistAction({ productId, on: !on });
            if (!r.ok && r.signedIn === false) {
              router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
              return;
            }
            if (r.ok) setOn(!on);
            setMsg(r.ok ? r.message : r.error);
          })
        }
        className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-label-md font-bold", on ? "bg-urgent-soft text-urgent-ink" : "bg-surface-high text-navy")}
        data-testid="wishlist-button"
      >
        <Icon name="favorite" filled={on} /> {on ? "Saved" : "Save"}
        <span className="sr-only"> {productName} to wishlist</span>
      </button>
      {msg ? (
        <span role="status" className="text-label-sm text-ink-muted">
          {msg}
        </span>
      ) : null}
    </span>
  );
}

export function WishlistRemove({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await toggleWishlistAction({ productId, on: false }); router.refresh(); })}
      className="flex size-11 items-center justify-center rounded-full bg-surface-high text-urgent-ink"
      aria-label={`Remove ${productName} from wishlist`}
    >
      <Icon name="delete" />
    </button>
  );
}
