import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, STAFF_ROLES } from "@/server/session";
import { getOrderDetail } from "@/server/services/admin-orders";
import { describeOrderEvent, PAYMENT_METHOD_LABEL, staffStatusActions, type PaymentMethod } from "@/lib/admin-orders";
import { CHANNEL_LABEL, type ChatChannelKind } from "@/lib/chat/links";
import { formatNaira } from "@/lib/money";
import { formatNgPhoneLocal } from "@/lib/phone";
import { formatLagosDateTime } from "@/lib/time";
import { Icon } from "@/components/icons/icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/status-badges";
import { OrderStatusActions, PaymentFlagActions } from "@/components/admin/order-actions";
import { RecordPaymentForm } from "@/components/admin/record-payment-form";
import { AssignDispatcherForm } from "@/components/admin/assign-dispatcher-form";
import { OrderNoteForm } from "@/components/admin/note-form";
import { CopyButton } from "@/components/admin/copy-button";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id.slice(0, 8)}` };
}

function Section({ title, icon, children, testId }: { title: string; icon: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card" aria-label={title} data-testid={testId}>
      <h2 className="flex items-center gap-1.5 text-label-lg font-bold text-navy">
        <Icon name={icon} className="text-lg text-bronze" /> {title}
      </h2>
      {children}
    </section>
  );
}

export default async function AdminOrderPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await requireRole(STAFF_ROLES, `/admin/orders/${id}`);
  const d = await getOrderDetail(session, id);
  if (!d) notFound();
  const o = d.order;
  const balance = Math.max(o.totalKobo - o.amountPaidKobo, 0);
  const overpaid = Math.max(o.amountPaidKobo - o.totalKobo, 0);
  const active = d.assignments.find((a) => a.status === "assigned") ?? null;
  const canAssign = o.status === "confirmed" || o.status === "dispatched";
  const canPay = o.status !== "cancelled";
  const bankText = d.bankAccounts.map((b) => `${b.bank}\n${b.accountName}\n${b.accountNumber}`).join("\n\n");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/admin/orders" className="inline-flex w-fit items-center gap-1 text-label-md text-navy">
          <Icon name="arrow_back" className="text-base" /> Orders
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-headline-md font-bold text-navy tabular" data-testid="order-number">
            {o.orderNumber}
          </h1>
          <OrderStatusBadge status={o.status} />
          <PaymentStatusBadge status={o.paymentStatus} />
          {o.isDuplicateSuspect ? (
            <Badge tone="redSoft" size="pill" icon="warning">
              Possible duplicate{o.duplicateOfNumber ? ` of ${o.duplicateOfNumber}` : ""}
            </Badge>
          ) : null}
          {o.isOverpaid ? (
            <Badge tone="redSoft" size="pill" data-testid="overpaid">
              Overpaid by {formatNaira(overpaid)}
            </Badge>
          ) : null}
        </div>
        <p className="text-body-sm text-ink-muted">
          Placed {formatLagosDateTime(o.createdAt)} via {o.source.replace("_", " ")}
          {o.utmSource ? ` · ${o.utmSource}${o.utmCampaign ? ` / ${o.utmCampaign}` : ""}` : ""}
          {o.fbclid ? " · from a Meta ad" : ""}
        </p>
        {d.autoCancelAt ? (
          <p className="rounded-lg bg-gold-soft/30 px-3 py-2 text-label-md text-bronze-ink">
            Unpaid and not yet in chat — auto-cancels {formatLagosDateTime(d.autoCancelAt)} and releases the stock.
          </p>
        ) : null}
      </div>

      {/* Chat-first actions */}
      <div className="flex flex-wrap gap-2">
        <a
          href={d.links.greeting}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-ink px-4 text-label-md font-bold text-on-dark shadow-card"
          data-testid="staff-whatsapp"
        >
          <WhatsAppIcon /> Open WhatsApp chat
        </a>
        <a
          href={d.links.confirmation}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-high px-4 text-label-md font-bold text-navy"
        >
          <Icon name="task_alt" /> Confirm via WhatsApp
        </a>
        <a href={d.links.call} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-high px-4 text-label-md font-bold text-navy">
          <Icon name="call" /> Call
        </a>
        <Link
          href={`/admin/orders/${o.id}/print`}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-high px-4 text-label-md font-bold text-navy"
        >
          <Icon name="print" /> Print
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          <Section title="Status" icon="autorenew" testId="status-section">
            <OrderStatusActions orderId={o.id} actions={staffStatusActions(o.status)} />
          </Section>

          <Section title="Items" icon="shopping_bag">
            <ul className="flex flex-col divide-y divide-line">
              {o.lines.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-body-md">
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{l.isFreeGift ? `🎁 ${l.name}` : (l.bundleLabel ?? l.name)}</span>
                    <span className="block text-body-sm text-ink-muted">
                      {l.isFreeGift ? "Free gift" : `${l.packs} pack${l.packs === 1 ? "" : "s"} · ${l.units} unit${l.units === 1 ? "" : "s"} · ${l.name}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold tabular">{l.isFreeGift ? "Free" : formatNaira(l.lineTotalKobo)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-y-1 text-body-md" data-testid="order-totals">
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="text-right tabular">{formatNaira(o.subtotalKobo)}</dd>
              <dt className="text-ink-muted">Delivery ({o.state})</dt>
              <dd className="text-right tabular">{formatNaira(o.deliveryFeeKobo)}</dd>
              <dt className="font-bold text-navy">Total</dt>
              <dd className="text-right font-bold text-navy tabular" data-testid="order-total">
                {formatNaira(o.totalKobo)}
              </dd>
              <dt className="text-ink-muted">Paid (verified)</dt>
              <dd className="text-right tabular" data-testid="order-paid">
                {formatNaira(o.amountPaidKobo)}
              </dd>
              <dt className="font-semibold text-ink">Balance</dt>
              <dd className="text-right font-semibold tabular" data-testid="order-balance">
                {formatNaira(balance)}
              </dd>
            </dl>
          </Section>

          <Section title="Payments" icon="payments" testId="payments-section">
            <PaymentFlagActions orderId={o.id} paymentStatus={o.paymentStatus} podAgreed={o.podAgreed} />
            {d.payments.length > 0 ? (
              <ul className="flex flex-col gap-2" data-testid="payment-list">
                {d.payments.map((p) => (
                  <li key={p.id} className="flex flex-col gap-0.5 rounded-lg bg-surface-low p-2.5 text-body-sm">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-bold text-ink">
                        {p.kind === "refund" ? "Refund " : ""}
                        {formatNaira(p.amountKobo)} · {PAYMENT_METHOD_LABEL[p.method as PaymentMethod] ?? p.method}
                      </span>
                      <span className="text-ink-muted">{formatLagosDateTime(p.createdAt)}</span>
                    </span>
                    <span className="text-ink-muted">
                      by {p.recordedByName ?? p.recordedByRole} ({p.recordedByRole}){p.reference ? ` · ref ${p.reference}` : ""}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                    {p.proofUrl ? (
                      <a href={p.proofUrl} target="_blank" rel="noopener" className="w-fit text-label-sm font-bold text-navy underline">
                        View proof
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-ink-muted">No payments recorded yet.</p>
            )}
            {canPay ? <RecordPaymentForm orderId={o.id} balanceKobo={balance} overpaidKobo={overpaid} /> : null}
          </Section>

          <Section title="Timeline" icon="history" testId="timeline">
            <ol className="flex flex-col gap-2">
              {d.events.map((e) => (
                <li key={e.id} className="flex gap-2 text-body-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-bronze" aria-hidden />
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{describeOrderEvent(e)}</span>
                    {e.note ? <span className="block whitespace-pre-line text-ink">{e.note}</span> : null}
                    <span className="block text-ink-muted">
                      {formatLagosDateTime(e.createdAt)} · {e.actorName ?? e.actorRole}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          <Section title="Customer & delivery" icon="person">
            <dl className="flex flex-col gap-1.5 text-body-md">
              <div>
                <dt className="text-label-sm text-ink-muted">Name</dt>
                <dd className="font-semibold">{o.customerName}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-ink-muted">WhatsApp</dt>
                <dd className="flex items-center gap-2">
                  <a href={`tel:${o.phoneE164}`} className="font-semibold text-navy">
                    {formatNgPhoneLocal(o.phoneE164)}
                  </a>
                  <CopyButton text={o.phoneE164} label="Copy" />
                </dd>
              </div>
              {o.altPhoneE164 ? (
                <div>
                  <dt className="text-label-sm text-ink-muted">Alternative phone</dt>
                  <dd>{formatNgPhoneLocal(o.altPhoneE164)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-label-sm text-ink-muted">Address</dt>
                <dd>
                  {o.address}, {o.city}, {o.state}
                  {o.landmark ? <span className="block text-ink-muted">Landmark: {o.landmark}</span> : null}
                </dd>
              </div>
              <div>
                <dt className="text-label-sm text-ink-muted">Ships from</dt>
                <dd>
                  {o.hubName} · {o.sameDay ? "same-day" : `${o.etaMinDays}–${o.etaMaxDays} days`}
                </dd>
              </div>
              <div>
                <dt className="text-label-sm text-ink-muted">Chat</dt>
                <dd>
                  {CHANNEL_LABEL[o.chatChannel as ChatChannelKind] ?? o.chatChannel}
                  {o.chatNumber ? ` · ${o.chatNumber}` : ""} ·{" "}
                  {o.chatClickedAt ? `opened ${formatLagosDateTime(o.chatClickedAt)}` : "not opened yet"}
                </dd>
              </div>
              {o.customerNote ? (
                <div>
                  <dt className="text-label-sm text-ink-muted">Customer note</dt>
                  <dd>{o.customerNote}</dd>
                </div>
              ) : null}
            </dl>
          </Section>

          {d.bankAccounts.length > 0 ? (
            <Section title="Bank details to send" icon="account_balance">
              {d.bankAccounts.map((b) => (
                <p key={b.accountNumber} className="text-body-md">
                  <span className="font-semibold">{b.bank}</span>
                  <br />
                  {b.accountName}
                  <br />
                  <span className="tabular">{b.accountNumber}</span>
                </p>
              ))}
              <CopyButton text={bankText} label="Copy bank details" className="w-fit" />
            </Section>
          ) : null}

          <Section title="Dispatch" icon="local_shipping" testId="dispatch-section">
            {d.assignments.length > 0 ? (
              <ul className="flex flex-col gap-1.5 text-body-sm">
                {d.assignments.map((a) => (
                  <li key={a.id} className="rounded-lg bg-surface-low p-2.5">
                    <span className="font-semibold">{a.dispatcherName ?? "Dispatcher"}</span> · {a.status} · {formatLagosDateTime(a.assignedAt)}
                    {a.collectedKobo > 0 ? (
                      <span className="block">
                        Collected {formatNaira(a.collectedKobo)}
                        {a.collectedMethod ? ` (${PAYMENT_METHOD_LABEL[a.collectedMethod as PaymentMethod] ?? a.collectedMethod})` : ""}
                      </span>
                    ) : null}
                    {a.failureReason ? <span className="block text-urgent-ink">Failed: {a.failureReason}</span> : null}
                    {a.proofUrl ? (
                      <a href={a.proofUrl} target="_blank" rel="noopener" className="font-bold text-navy underline">
                        Proof photo
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {canAssign ? (
              <AssignDispatcherForm orderId={o.id} dispatchers={d.dispatchers} currentId={active?.dispatcherId ?? null} defaultHub={null} />
            ) : (
              <p className="text-body-sm text-ink-muted">Confirm the order to assign a dispatcher.</p>
            )}
          </Section>

          <Section title="Notes" icon="edit">
            <OrderNoteForm orderId={o.id} />
          </Section>
        </div>
      </div>
    </div>
  );
}
