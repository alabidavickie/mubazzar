import Link from "next/link";
import { requireRole, STAFF_ROLES } from "@/server/session";
import { getDashboard } from "@/server/services/admin-dashboard";
import { lowStockCount } from "@/server/services/admin-inventory";
import { formatNaira } from "@/lib/money";
import { formatLagosDateTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/status-badges";

export const metadata = { title: "Dashboard" };

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-card p-3 shadow-card">
      <span className="text-label-sm text-ink-muted uppercase">{label}</span>
      <span className="text-headline-sm font-extrabold text-navy-deep tabular" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

function Queue({ href, label, count, icon, urgent }: { href: string; label: string; count: number; icon: string; urgent?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-14 items-center justify-between gap-2 rounded-xl p-3 shadow-card",
        urgent && count > 0 ? "bg-gold-soft/40 text-bronze-ink" : "bg-card text-ink",
      )}
    >
      <span className="flex items-center gap-2 text-label-md font-semibold">
        <Icon name={icon} className="text-lg" /> {label}
      </span>
      <span className="text-headline-sm font-extrabold tabular">{count}</span>
    </Link>
  );
}

export default async function AdminDashboard() {
  const session = await requireRole(STAFF_ROLES, "/admin");
  const [d, low] = await Promise.all([getDashboard(session), session.role === "admin" ? lowStockCount(session) : Promise.resolve(0)]);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-headline-md font-bold text-navy">Hello, {session.fullName?.split(" ")[0] ?? "team"} 👋</h1>

      <section aria-label="Today" className="flex flex-col gap-2">
        <h2 className="text-label-lg font-bold text-navy">Today</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Stat label="Orders" value={String(d.today.orders)} testId="today-orders" />
          <Stat label="Order value" value={formatNaira(d.today.orderValueKobo)} />
          <Stat label="Verified payments" value={formatNaira(d.today.verifiedKobo)} testId="today-verified" />
          <Stat label="Delivered" value={String(d.today.delivered)} />
        </div>
      </section>

      <section aria-label="Work queues" className="flex flex-col gap-2">
        <h2 className="text-label-lg font-bold text-navy">Needs action</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Queue href="/admin/orders?status=awaiting_chat" label="Awaiting chat" count={d.queues.awaitingChat} icon="chat" urgent />
          <Queue href="/admin/orders?payment=payment_claimed" label="Customer says paid — verify" count={d.queues.paymentClaimed} icon="price_check" urgent />
          <Queue href="/admin/orders?view=follow_up" label="Follow up before auto-cancel" count={d.queues.followUp} icon="hourglass_top" urgent />
          <Queue href="/admin/orders?status=confirmed" label="Confirmed — assign rider" count={d.queues.confirmed} icon="inventory_2" />
          <Queue href="/admin/orders?status=dispatched" label="Out for delivery" count={d.queues.outForDelivery} icon="local_shipping" />
          <Queue href="/admin/orders?status=failed_delivery" label="Failed deliveries" count={d.queues.failed} icon="report" urgent />
        </div>
        {session.role === "admin" && low > 0 ? (
          <Link href="/admin/inventory?low=1" className="flex min-h-12 items-center gap-2 rounded-xl bg-urgent-soft px-3 text-label-md font-semibold text-urgent-ink" data-testid="low-stock-alert">
            <Icon name="warning" /> {low} product{low === 1 ? " is" : "s are"} low on stock — restock soon
          </Link>
        ) : null}
      </section>

      <section aria-label="Today's orders" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-label-lg font-bold text-navy">Today&apos;s orders</h2>
          <Link href="/admin/orders" className="text-label-md text-navy underline-offset-2 hover:underline">
            All orders →
          </Link>
        </div>
        {d.recent.length === 0 ? (
          <p className="text-body-md text-ink-muted">No orders yet today.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {d.recent.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-3 text-body-md shadow-card">
                  <span className="font-bold text-navy tabular">{o.orderNumber}</span>
                  <OrderStatusBadge status={o.status} />
                  <PaymentStatusBadge status={o.paymentStatus} />
                  <span className="min-w-0 flex-1 truncate">
                    {o.customerName} · {o.state}
                  </span>
                  <span className="font-bold tabular">{formatNaira(o.totalKobo)}</span>
                  <span className="text-body-sm text-ink-muted">{formatLagosDateTime(o.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
