import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole, STAFF_ROLES } from "@/server/session";
import { getOrderDetail } from "@/server/services/admin-orders";
import { formatNaira } from "@/lib/money";
import { formatNgPhoneLocal } from "@/lib/phone";
import { formatLagosDateTime } from "@/lib/time";
import { PAYMENT_STATUS_LABEL, type PaymentStatus } from "@/lib/payments/status";
import { PrintButton } from "@/components/admin/print-button";

export const metadata: Metadata = { title: "Packing slip" };

type Params = Promise<{ id: string }>;

/** Printable packing slip / delivery note (no prices hidden: riders collect balances). */
export default async function PrintOrderPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await requireRole(STAFF_ROLES, `/admin/orders/${id}/print`);
  const d = await getOrderDetail(session, id);
  if (!d) notFound();
  const o = d.order;
  const balance = Math.max(o.totalKobo - o.amountPaidKobo, 0);
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-4 bg-card p-6 text-ink print:p-0 print:shadow-none" data-testid="packing-slip">
      <header className="flex items-start justify-between gap-4 border-b border-line pb-3">
        <div>
          <p className="font-display text-headline-md font-extrabold text-navy">MUBAZZAR</p>
          <p className="text-body-sm text-ink-muted">Delivery note · {formatLagosDateTime(o.createdAt)}</p>
        </div>
        <div className="text-right">
          <p className="text-headline-sm font-bold tabular">{o.orderNumber}</p>
          <p className="text-body-sm">{PAYMENT_STATUS_LABEL[o.paymentStatus as PaymentStatus] ?? o.paymentStatus}</p>
        </div>
      </header>
      <section>
        <h2 className="text-label-sm text-ink-muted uppercase">Deliver to</h2>
        <p className="text-body-lg font-semibold">{o.customerName}</p>
        <p>
          {formatNgPhoneLocal(o.phoneE164)}
          {o.altPhoneE164 ? ` · ${formatNgPhoneLocal(o.altPhoneE164)}` : ""}
        </p>
        <p>
          {o.address}, {o.city}, {o.state}
        </p>
        {o.landmark ? <p>Landmark: {o.landmark}</p> : null}
      </section>
      <table className="w-full text-body-md">
        <thead>
          <tr className="border-b border-line text-left text-label-sm text-ink-muted uppercase">
            <th className="py-1">Item</th>
            <th className="py-1 text-right">Units</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {o.lines.map((l, i) => (
            <tr key={i} className="border-b border-line">
              <td className="py-1.5">{l.isFreeGift ? `Free gift: ${l.name}` : (l.bundleLabel ?? l.name)}</td>
              <td className="py-1.5 text-right tabular">{l.units}</td>
              <td className="py-1.5 text-right tabular">{l.isFreeGift ? "—" : formatNaira(l.lineTotalKobo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto grid w-64 grid-cols-2 gap-y-1 text-body-md">
        <dt>Subtotal</dt>
        <dd className="text-right tabular">{formatNaira(o.subtotalKobo)}</dd>
        <dt>Delivery</dt>
        <dd className="text-right tabular">{formatNaira(o.deliveryFeeKobo)}</dd>
        <dt className="font-bold">Total</dt>
        <dd className="text-right font-bold tabular">{formatNaira(o.totalKobo)}</dd>
        <dt>Paid</dt>
        <dd className="text-right tabular">{formatNaira(o.amountPaidKobo)}</dd>
        <dt className="font-bold">To collect</dt>
        <dd className="text-right font-bold tabular" data-testid="slip-balance">
          {formatNaira(balance)}
        </dd>
      </dl>
      <p className="text-body-sm text-ink-muted">Tested before dispatch. Questions? WhatsApp MUBAZZAR. We never ask for card PINs or OTPs.</p>
      <PrintButton />
    </article>
  );
}
