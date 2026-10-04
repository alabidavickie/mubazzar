"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cn } from "@/lib/cn";
import { formatNaira } from "@/lib/money";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/icons/icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { trackOrderAction, type TrackState, type TrackedOrder } from "@/app/actions/track";
import { logChatClickClient } from "@/lib/client/chat-click";

export function TrackOrderForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrderAction, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;

  return (
    <div className="flex flex-col gap-4">
      <form action={action} noValidate className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card" data-testid="track-form">
        <Field label="Order number" icon="receipt_long" required error={fieldErrors?.orderNumber}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="orderNumber"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="MBZ-7K2QPA"
              defaultValue={values?.orderNumber ?? ""}
              key={`on-${values?.orderNumber ?? ""}`}
            />
          )}
        </Field>
        <Field label="Phone number used for the order" icon="call" required error={fieldErrors?.phone}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="0803 123 4567"
              defaultValue={values?.phone ?? ""}
              key={`ph-${values?.phone ?? ""}`}
            />
          )}
        </Field>
        {state && !state.ok && !fieldErrors ? (
          <p role="alert" className="rounded-lg bg-urgent-soft p-3 text-body-sm font-semibold text-urgent-ink" data-testid="track-error">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 text-label-lg font-bold text-on-dark disabled:opacity-60"
        >
          <Icon name={pending ? "autorenew" : "search"} className={pending ? "animate-spin" : undefined} />
          {pending ? "Checking…" : "Track order"}
        </button>
      </form>
      {state?.ok ? <TrackResult order={state.order} /> : null}
    </div>
  );
}

function TrackResult({ order }: { order: TrackedOrder }) {
  const problem = order.status === "cancelled" || order.status === "failed_delivery" || order.status === "returned";
  return (
    <section aria-labelledby="track-result-title" className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-raised" data-testid="track-result">
      <div className="flex flex-col gap-0.5">
        <p className="text-body-sm text-ink-muted">Placed {order.placedAt}</p>
        <h2 id="track-result-title" className="text-headline-sm font-bold text-navy">
          Order <span className="tabular">{order.orderNumber}</span>
        </h2>
        <p className={cn("text-label-lg", problem ? "text-urgent" : "text-emerald-ink")} data-testid="track-status">
          {order.statusLabel}
        </p>
      </div>

      <ol className="flex flex-col" aria-label="Order progress">
        {order.timeline.map((s, i) => (
          <li key={s.key} className="relative flex gap-3 pb-3 last:pb-0" aria-current={s.state === "current" ? "step" : undefined}>
            {i < order.timeline.length - 1 ? (
              <span aria-hidden className={cn("absolute top-6 left-[0.6875rem] h-[calc(100%-1.25rem)] w-0.5", s.state === "done" ? "bg-emerald" : "bg-line")} />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full",
                s.state === "done" && "bg-emerald-ink text-on-dark",
                s.state === "current" && "bg-gold-soft text-bronze-ink ring-4 ring-gold-soft/40",
                s.state === "upcoming" && "border-2 border-line bg-card text-ink-subtle",
                s.state === "problem" && "bg-urgent text-on-dark",
              )}
            >
              <Icon
                name={s.state === "done" ? "check" : s.state === "problem" ? "close" : s.state === "current" ? "pending" : "radio_button_unchecked"}
                className="text-sm"
              />
            </span>
            <span className="min-w-0">
              <span className={cn("block text-label-md", s.state === "upcoming" ? "text-ink-subtle" : "font-bold text-ink")}>
                {s.label}
                <span className="sr-only">
                  {s.state === "done" ? " (done)" : s.state === "current" ? " (current step)" : s.state === "problem" ? "" : " (upcoming)"}
                </span>
              </span>
              {s.atText ? <span className="block text-body-sm text-ink-muted">{s.atText}</span> : null}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-1 rounded-lg bg-surface-low p-3 text-body-md">
        <p className="flex items-center gap-1.5">
          <Icon name="local_shipping" className="text-base text-emerald-ink" /> {order.etaText} · {order.deliverTo}
        </p>
        <p className="flex items-center gap-1.5">
          <Icon name="payments" className="text-base text-navy" /> Payment: <strong data-testid="track-payment">{order.paymentLabel}</strong>
        </p>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-line pt-3">
        {order.items.map((it, i) => (
          <p key={i} className="flex justify-between gap-3 text-body-md">
            <span className={it.isFreeGift ? "text-emerald-ink" : "text-ink"}>{it.label}</span>
            <span className="shrink-0 font-bold tabular">{it.isFreeGift ? "FREE" : formatNaira(it.lineTotalKobo)}</span>
          </p>
        ))}
        <p className="flex justify-between text-body-md text-ink-muted">
          <span>Delivery</span>
          <span className="tabular">{order.deliveryFeeKobo === 0 ? "Free" : formatNaira(order.deliveryFeeKobo)}</span>
        </p>
        <p className="flex items-baseline justify-between border-t border-line pt-1.5">
          <span className="font-bold text-navy">Total</span>
          <span className="text-headline-sm font-extrabold text-navy-deep tabular" data-testid="track-total">
            {formatNaira(order.totalKobo)}
          </span>
        </p>
        {order.amountPaidKobo > 0 ? (
          <p className="flex justify-between text-body-md text-emerald-ink">
            <span>Paid so far</span>
            <span className="font-bold tabular">{formatNaira(order.amountPaidKobo)}</span>
          </p>
        ) : null}
      </div>

      {order.whatsappHref ? (
        <a
          href={order.whatsappHref}
          target="_blank"
          rel="noopener"
          data-testid="track-whatsapp"
          onClick={() => logChatClickClient(order.token, "whatsapp", "track")}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-ink px-5 py-3 text-label-lg font-bold text-on-dark uppercase shadow-float"
        >
          <WhatsAppIcon className="text-2xl" /> Continue on WhatsApp
        </a>
      ) : null}
      <Link href={order.orderPath} className="flex min-h-11 items-center justify-center text-label-md font-bold text-navy underline underline-offset-2">
        View full order &amp; payment details
      </Link>
    </section>
  );
}
