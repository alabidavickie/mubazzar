"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DELIVERY_FIELDS, deliveryDetailsSchema, type DeliveryDetailsInput, type DeliveryDetails } from "@/lib/schemas/order";
import { NG_STATES, stateDisplayName } from "@/lib/ng-states";
import { quoteDelivery, type DeliveryZone } from "@/lib/delivery";
import { formatNaira } from "@/lib/money";
import { formatCutoff } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/icons/icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { submitOrderAction } from "@/app/actions/order";
import { readAttribution } from "@/lib/client/attribution";
import { newEventId, track } from "@/lib/client/pixel";
import type { ChatChannelKind } from "@/lib/chat/links";

export interface OrderFormItem {
  productId: string;
  bundleId: string | null;
  packs: number;
}

export interface OrderFormChannel {
  kind: ChatChannelKind;
  label: string;
}

export interface OrderFormProps {
  source: "landing_page" | "checkout" | "quick_order";
  items: OrderFormItem[];
  /** Display-only summary of what is being ordered (server recomputes). */
  summaryLabel: string;
  subtotalKobo: number;
  zones: DeliveryZone[];
  channels: OrderFormChannel[];
  cutoff: string;
  landingPageId?: string | null;
  defaultState?: string | null;
  compact?: boolean;
  onStateChange?: (state: string) => void;
  onSuccess?: () => void;
  analytics?: { contentIds: string[]; value: number };
  idPrefix?: string;
}

const CHANNEL_CTA: Record<ChatChannelKind, string> = {
  whatsapp: "Place Order & Pay on WhatsApp",
  instagram: "Place Order & Continue on Instagram",
  messenger: "Place Order & Continue on Messenger",
  telegram: "Place Order & Continue on Telegram",
  phone: "Place Order & We'll Call You",
};

export function OrderForm(props: OrderFormProps) {
  const {
    source,
    items,
    summaryLabel,
    subtotalKobo,
    zones,
    channels,
    cutoff,
    landingPageId,
    defaultState,
    compact,
    onStateChange,
    onSuccess,
    analytics,
    idPrefix = "order",
  } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  // One key per form instance: double taps / retries of the same order are deduplicated server-side.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const checkoutTracked = useRef(false);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<DeliveryDetailsInput, unknown, DeliveryDetails>({
    resolver: zodResolver(deliveryDetailsSchema),
    mode: "onTouched",
    defaultValues: {
      customerName: "",
      phone: "",
      altPhone: "",
      state: (defaultState && (NG_STATES as readonly string[]).includes(defaultState) ? defaultState : "") as never,
      city: "",
      address: "",
      landmark: "",
      chatChannel: "whatsapp",
      note: "",
    },
  });

  const state = (useWatch({ control, name: "state" }) ?? "") as string;
  const chatChannel = (useWatch({ control, name: "chatChannel" }) ?? "whatsapp") as ChatChannelKind;
  useEffect(() => {
    if (state) onStateChange?.(state);
  }, [state, onStateChange]);

  const zone = useMemo(() => zones.find((z) => z.state === state) ?? null, [zones, state]);
  const quote = zone ? quoteDelivery(zone, cutoff) : null;
  const totalKobo = subtotalKobo + (quote?.feeKobo ?? 0);
  const otherChannels = channels.filter((c) => c.kind !== "whatsapp");
  const hasWhatsApp = channels.some((c) => c.kind === "whatsapp");

  const onFirstInteraction = () => {
    if (checkoutTracked.current) return;
    checkoutTracked.current = true;
    track("InitiateCheckout", {
      content_ids: analytics?.contentIds,
      value: (analytics?.value ?? subtotalKobo) / 100,
      currency: "NGN",
    });
  };

  const onSubmit = (values: DeliveryDetails, event?: React.BaseSyntheticEvent) => {
    setFormError(null);
    const formEl = event?.target as HTMLFormElement | undefined;
    const website = (formEl?.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "";
    const eventId = newEventId("lead");
    startTransition(async () => {
      const res = await submitOrderAction({
        ...values,
        items,
        source,
        landingPageId: landingPageId ?? null,
        idempotencyKey,
        attribution: readAttribution(),
        eventId,
        website,
      });
      if (!res.ok) {
        if (res.fieldErrors) {
          for (const [k, msg] of Object.entries(res.fieldErrors)) {
            if ((DELIVERY_FIELDS as string[]).includes(k)) setError(k as keyof DeliveryDetailsInput, { message: msg });
          }
        }
        setFormError(res.error);
        return;
      }
      track("Lead", { value: res.totalKobo / 100, currency: "NGN", order_id: res.orderNumber }, eventId);
      onSuccess?.();
      router.push(`/order/${res.publicToken}`);
    });
  };

  const fid = (name: string) => `${idPrefix}-${name}`;

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      onFocusCapture={onFirstInteraction}
      className="flex flex-col gap-3"
      aria-describedby={formError ? fid("form-error") : undefined}
      data-testid="order-form"
    >
      {/* Honeypot — hidden from people and assistive tech, attractive to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={fid("website")}>Website</label>
        <input id={fid("website")} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-container p-3">
        <div className="min-w-0">
          <p className="text-label-sm text-ink-muted">Selected package:</p>
          <p className="text-label-lg font-bold text-navy" data-testid="summary-label">
            {summaryLabel}
          </p>
        </div>
        <p className="shrink-0 text-headline-sm font-extrabold text-navy-deep tabular" data-testid="summary-subtotal">
          {formatNaira(subtotalKobo)}
        </p>
      </div>

      <Field label="Full Name" icon="person" required error={errors.customerName?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            autoComplete="name"
            placeholder="e.g. Babatunde Adeyemi"
            {...register("customerName")}
          />
        )}
      </Field>

      <Field
        label="Active WhatsApp Phone Number"
        icon="call"
        required
        hint="We'll confirm your order and delivery on this number."
        error={errors.phone?.message}
      >
        {({ id, describedBy, invalid }) => (
          <div className="flex gap-2">
            <span className="flex shrink-0 items-center gap-1 rounded-lg bg-surface-high px-3 text-label-md text-navy" aria-hidden="true">
              🇳🇬 +234
            </span>
            <Input
              id={id}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="0803 123 4567"
              {...register("phone")}
            />
          </div>
        )}
      </Field>

      {!compact ? (
        <Field label="Alternative Phone (optional)" icon="phone_iphone" error={errors.altPhone?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="In case the first one is unreachable"
              {...register("altPhone")}
            />
          )}
        </Field>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Delivery State" icon="map" required error={errors.state?.message}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="address-level1" {...register("state")}>
              <option value="">— Choose your state —</option>
              {zones.map((z) => (
                <option key={z.state} value={z.state}>
                  {stateDisplayName(z.state)}
                  {z.sameDayEnabled ? " (Same-day available)" : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="LGA / City" icon="location_on" required error={errors.city?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoComplete="address-level2"
              placeholder="e.g. Ikeja, Gwarinpa, Port Harcourt"
              {...register("city")}
            />
          )}
        </Field>
      </div>

      <Field label="Full Street / Office Address" icon="home_pin" required error={errors.address?.message}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            rows={2}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            autoComplete="street-address"
            placeholder="House number, street name, area"
            {...register("address")}
          />
        )}
      </Field>

      <Field label="Nearest Landmark / Bus-stop (optional)" icon="navigation" error={errors.landmark?.message}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} placeholder="e.g. Opposite Shoprite" {...register("landmark")} />
        )}
      </Field>

      {otherChannels.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-label-md font-semibold text-navy">Where should we chat to confirm & take payment?</legend>
          <div className="grid grid-cols-2 gap-2">
            {(hasWhatsApp ? [{ kind: "whatsapp" as const, label: "WhatsApp" }, ...otherChannels] : otherChannels).map((c) => (
              <label
                key={c.kind}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border-[1.5px] bg-card px-3 py-2 text-label-md text-navy",
                  chatChannel === c.kind ? "border-gold bg-gold-soft/15" : "border-line",
                )}
              >
                <input type="radio" value={c.kind} className="size-4 accent-navy" {...register("chatChannel")} />
                {c.kind === "whatsapp" ? <WhatsAppIcon className="text-emerald-ink" /> : null}
                <span>{c.kind === "whatsapp" ? "WhatsApp (fastest)" : c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {/* Live order summary */}
      <div className="rounded-lg border border-line bg-surface-low p-3 text-body-md" aria-live="polite" data-testid="order-summary">
        <div className="flex justify-between">
          <span className="text-ink-muted">Subtotal</span>
          <span className="font-bold tabular">{formatNaira(subtotalKobo)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-muted">Delivery{zone ? ` to ${stateDisplayName(zone.state)}` : ""}</span>
          <span className="font-bold tabular" data-testid="summary-delivery">
            {quote ? (quote.feeKobo === 0 ? "Free" : formatNaira(quote.feeKobo)) : "Choose state"}
          </span>
        </div>
        {quote ? (
          <p className="mt-0.5 flex items-center gap-1 text-body-sm font-semibold text-emerald-ink">
            <Icon name="local_shipping" className="text-sm" />
            {quote.label}
            {zone?.sameDayEnabled && !quote.sameDay ? ` · order before ${formatCutoff(cutoff)} for same-day` : ""}
          </p>
        ) : null}
        <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
          <span className="font-bold text-navy">Total</span>
          <span className="text-headline-sm font-extrabold text-navy-deep tabular" data-testid="summary-total">
            {formatNaira(totalKobo)}
          </span>
        </div>
      </div>

      {formError ? (
        <p id={fid("form-error")} role="alert" className="rounded-lg bg-urgent-soft p-3 text-body-sm font-semibold text-urgent-ink">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || items.length === 0}
        className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-lg border-t-2 border-gold bg-navy px-4 py-3 text-on-dark shadow-float transition active:scale-[0.99] disabled:opacity-60"
      >
        <span className="flex items-center gap-2 text-label-lg font-bold uppercase tracking-wide">
          {pending ? (
            <>
              <Icon name="autorenew" className="animate-spin" /> Saving your order…
            </>
          ) : (
            <>
              {chatChannel === "whatsapp" ? <WhatsAppIcon className="text-gold-soft" /> : <Icon name="chat" className="text-gold-soft" />}
              {CHANNEL_CTA[chatChannel]}
            </>
          )}
        </span>
        <span className="text-body-sm text-gold-pale tabular">Total {formatNaira(totalKobo)} · No payment on this page</span>
      </button>
      <p className="flex items-start gap-1.5 text-body-sm text-ink-muted">
        <Icon name="lock" className="mt-0.5 text-sm text-emerald-ink" />
        <span>
          After you place your order, our team shares MUBAZZAR&apos;s official payment details securely in chat. Pay on
          Delivery can be arranged there too. <strong className="text-ink">We will never ask for your card PIN or OTP.</strong>
        </span>
      </p>
    </form>
  );
}
