import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { getAccount } from "@/server/services/account";
import { formatNaira } from "@/lib/money";
import { formatLagosDate } from "@/lib/time";
import { ORDER_STATUS_CUSTOMER_LABEL, PAYMENT_STATUS_CUSTOMER_LABEL, type CustomerPaymentStatus, type OrderStatus } from "@/lib/order-timeline";
import { AccountNav } from "@/components/account/account-nav";
import { ReviewForm } from "@/components/account/account-forms";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireRole(["customer"], "/account");
  const { orders } = await getAccount(session);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <AccountNav current="/account" name={session.fullName?.split(" ")[0] ?? "there"} />
      <h2 className="text-label-lg font-bold text-navy">Your orders</h2>
      {orders.length === 0 ? (
        <EmptyState icon="receipt_long" title="No orders yet" body="Orders you place while signed in (or with your verified phone number) appear here." action={<Link href="/shop" className="text-label-md text-navy underline">Start shopping</Link>} />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="account-orders">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-card" data-testid="account-order">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/order/${o.publicToken}`} className="font-bold text-navy tabular underline-offset-2 hover:underline">
                  {o.orderNumber}
                </Link>
                <span className="text-body-sm text-ink-muted">{formatLagosDate(o.createdAt)}</span>
              </div>
              <p className="text-body-md">
                {ORDER_STATUS_CUSTOMER_LABEL[o.status as OrderStatus] ?? o.status} · {PAYMENT_STATUS_CUSTOMER_LABEL[o.paymentStatus as CustomerPaymentStatus] ?? o.paymentStatus}
              </p>
              <p className="text-body-sm text-ink-muted">
                {o.items.filter((i) => !i.isFreeGift).map((i) => `${i.units}× ${i.name}`).join(", ")} · <strong className="text-ink">{formatNaira(o.totalKobo)}</strong>
              </p>
              {o.status === "delivered"
                ? o.items
                    .filter((i) => !i.isFreeGift)
                    .map((i) =>
                      i.reviewed ? (
                        <p key={i.productId} className="text-body-sm text-emerald-ink" data-testid="reviewed">
                          ✓ You reviewed {i.name}. Thank you!
                        </p>
                      ) : (
                        <ReviewForm key={i.productId} orderId={o.id} productId={i.productId} productName={i.name} />
                      ),
                    )
                : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
