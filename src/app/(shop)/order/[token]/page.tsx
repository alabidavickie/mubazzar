import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { HandoffPanel } from "@/components/handoff/handoff-panel";
import { ClaimPaymentButton } from "@/components/handoff/claim-payment";
import { buildHandoff, getOrderViewByToken, type OrderLine } from "@/server/services/orders";
import { formatNaira } from "@/lib/money";
import { etaLabel } from "@/lib/delivery";
import { stateDisplayName } from "@/lib/ng-states";
import { CHANNEL_LABEL } from "@/lib/chat/links";
import {
  ORDER_STATUS_CUSTOMER_LABEL,
  PAYMENT_STATUS_CUSTOMER_LABEL,
  type CustomerPaymentStatus,
  type OrderStatus,
} from "@/lib/order-timeline";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order received",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

function lineLabel(l: OrderLine): string {
  if (l.isFreeGift) return l.name;
  const label = l.shortLabel ?? l.bundleLabel;
  if (label) return l.packs > 1 ? `${l.packs} × ${label}` : label;
  return `${l.units}x ${l.name}`;
}

export default async function OrderThankYouPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderViewByToken(token);
  if (!order) notFound();
  const handoff = await buildHandoff(order);

  const status = order.status as OrderStatus;
  const payment = order.paymentStatus as CustomerPaymentStatus;
  const cancelled = status === "cancelled";
  const settled = payment === "paid" || payment === "refunded";
  const firstName = order.customerName.trim().split(/\s+/)[0] ?? "";
  const eta = etaLabel({ sameDay: order.sameDay, etaMinDays: order.etaMinDays, etaMaxDays: order.etaMaxDays });
  const items = order.lines.filter((l) => !l.isFreeGift);
  const gifts = order.lines.filter((l) => l.isFreeGift);
  const canClaim = !cancelled && payment === "unpaid";
  const payLabel = settled || cancelled ? "Chat with us on WhatsApp" : "Complete Payment on WhatsApp";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-4">
      {/* Confirmation header */}
      <section aria-labelledby="ty-title" className="flex flex-col items-center gap-1 text-center">
        <span className={cancelled ? "text-ink-muted" : "text-emerald-ink"}>
          <Icon name={cancelled ? "cancel" : "check_circle"} filled className="text-5xl" />
        </span>
        <h1 id="ty-title" className="font-display text-headline-xl font-bold text-navy">
          {cancelled ? "This order was cancelled" : `Thank you${firstName ? `, ${firstName}` : ""}! Order saved.`}
        </h1>
        <p className="text-body-md text-ink-muted">Your order number</p>
        <p className="rounded-lg bg-navy px-4 py-1.5 font-sans text-headline-md font-extrabold tracking-widest text-gold-pale tabular" data-testid="order-number">
          {order.orderNumber}
        </p>
        <p className="text-body-sm text-ink-muted">Keep this number — you&apos;ll need it to track your order.</p>
      </section>

      {/* Primary next step: chat handoff */}
      <section aria-labelledby="pay-title" className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-raised">
        <div>
          <h2 id="pay-title" className="text-headline-sm font-bold text-navy">
            {cancelled ? "Need help with this order?" : settled ? "Questions about your order?" : "Next: confirm & pay in chat"}
          </h2>
          {!cancelled && !settled ? (
            <p className="text-body-sm text-ink-muted">
              {handoff.primary.kind === "whatsapp"
                ? "Send us your order on WhatsApp. Our team confirms it and shares MUBAZZAR's official payment details — or arranges Pay on Delivery."
                : `You chose ${CHANNEL_LABEL[handoff.primary.kind]}. Our team confirms your order there and shares MUBAZZAR's official payment details — or arranges Pay on Delivery.`}
            </p>
          ) : null}
        </div>
        <HandoffPanel
          token={order.publicToken}
          orderNumber={order.orderNumber}
          message={handoff.message}
          primary={handoff.primary}
          whatsappHref={handoff.whatsappHref}
          others={handoff.others}
          autoOpen={!cancelled && status === "awaiting_chat" && payment === "unpaid"}
          payLabel={payLabel}
        />
      </section>

      {/* Order summary */}
      <section aria-labelledby="summary-title" className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card">
        <h2 id="summary-title" className="text-headline-sm font-bold text-navy">
          Order summary
        </h2>
        <ul className="flex flex-col gap-2.5">
          {[...items, ...gifts].map((l, i) => (
            <li key={`${l.name}-${i}`} className="flex items-center gap-3" data-testid={l.isFreeGift ? "gift-line" : "item-line"}>
              <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-high">
                {l.imageUrl ? (
                  <Image src={l.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                ) : (
                  <Icon name={l.isFreeGift ? "redeem" : "package_2"} className="m-3 text-2xl text-navy" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-label-md font-bold text-ink">{lineLabel(l)}</span>
                {l.isFreeGift ? (
                  <span className="text-body-sm text-emerald-ink">Free gift included</span>
                ) : (
                  <span className="text-body-sm text-ink-muted">
                    {l.units} {l.units === 1 ? "unit" : "units"}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-label-md font-bold tabular">
                {l.isFreeGift ? <span className="text-emerald-ink">FREE</span> : formatNaira(l.lineTotalKobo)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1 border-t border-line pt-3 text-body-md">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="font-bold tabular" data-testid="order-subtotal">
              {formatNaira(order.subtotalKobo)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Delivery to {stateDisplayName(order.state)}</dt>
            <dd className="font-bold tabular" data-testid="order-delivery">
              {order.deliveryFeeKobo === 0 ? "Free" : formatNaira(order.deliveryFeeKobo)}
            </dd>
          </div>
          <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
            <dt className="font-bold text-navy">Total</dt>
            <dd className="text-headline-sm font-extrabold text-navy-deep tabular" data-testid="order-total">
              {formatNaira(order.totalKobo)}
            </dd>
          </div>
          {order.amountPaidKobo > 0 ? (
            <div className="flex justify-between text-emerald-ink">
              <dt>Paid so far</dt>
              <dd className="font-bold tabular">{formatNaira(order.amountPaidKobo)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* Delivery & status */}
      <section aria-labelledby="delivery-title" className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-card">
        <h2 id="delivery-title" className="text-headline-sm font-bold text-navy">
          Delivery &amp; status
        </h2>
        <p className="flex items-start gap-2 text-body-md">
          <Icon name="local_shipping" className="mt-0.5 text-emerald-ink" />
          <span>
            <strong className="text-ink">{eta}</strong>
            {order.sameDay ? " — ordered before today's cut-off." : " after your order is confirmed in chat."}
            <span className="block text-body-sm text-ink-muted">
              {order.address}, {order.city}, {stateDisplayName(order.state)}
              {order.landmark ? ` (near ${order.landmark})` : ""}
            </span>
          </span>
        </p>
        <p className="flex items-center gap-2 text-body-md">
          <Icon name="pending" className="text-navy" />
          <span>
            Order status: <strong data-testid="order-status">{ORDER_STATUS_CUSTOMER_LABEL[status] ?? status}</strong>
          </span>
        </p>
        <p className="flex items-center gap-2 text-body-md">
          <Icon name="payments" className="text-navy" />
          <span>
            Payment: <strong data-testid="payment-status">{PAYMENT_STATUS_CUSTOMER_LABEL[payment] ?? payment}</strong>
          </span>
        </p>
      </section>

      {/* How payment works */}
      <section aria-labelledby="how-pay-title" className="flex flex-col gap-2 rounded-xl bg-surface-low p-4">
        <h2 id="how-pay-title" className="flex items-center gap-1.5 text-label-lg font-bold text-navy">
          <Icon name="lock" className="text-emerald-ink" /> How payment works
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink-muted">
          <li>There is no payment on this website. Our team shares MUBAZZAR&apos;s official account details in chat, or agrees Pay on Delivery with you.</li>
          <li>
            <strong className="text-ink">We will never ask for your card PIN, OTP or BVN.</strong> Only pay into an account our team sends in
            this order&apos;s chat.
          </li>
          <li>Your payment is confirmed only after our team sees it in MUBAZZAR&apos;s bank account.</li>
        </ul>
        {canClaim ? <ClaimPaymentButton token={order.publicToken} /> : null}
        {payment === "payment_claimed" ? (
          <p role="status" className="rounded-lg bg-emerald-soft p-3 text-body-sm text-emerald-ink">
            You told us you&apos;ve paid. Our team is verifying it and will confirm in chat.
          </p>
        ) : null}
      </section>

      <p className="text-center text-body-sm text-ink-muted">
        Closed the chat? Come back any time from{" "}
        <Link href="/track" className="font-bold text-navy underline underline-offset-2">
          Track My Order
        </Link>
        .
      </p>
    </div>
  );
}
