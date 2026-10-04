import type { Metadata } from "next";
import Link from "next/link";
import { requireRole, STAFF_ROLES } from "@/server/session";
import { listOrders, ORDERS_PAGE_SIZE } from "@/server/services/admin-orders";
import { getDeliveryZones } from "@/server/services/settings";
import { ORDER_STATUS_LABEL, ORDER_STATUSES, PAYMENT_STATUSES, autoCancelAt, orderFiltersQuery, parseOrderFilters } from "@/lib/admin-orders";
import { PAYMENT_STATUS_LABEL } from "@/lib/payments/status";
import { formatNaira } from "@/lib/money";
import { formatNgPhoneLocal } from "@/lib/phone";
import { formatLagosDateTime, timeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/status-badges";

export const metadata: Metadata = { title: "Orders" };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Search }) {
  const session = await requireRole(STAFF_ROLES, "/admin/orders");
  const f = parseOrderFilters(await searchParams);
  const [{ rows, total, counts, followUpHours, autoCancelHours }, zones] = await Promise.all([listOrders(session, f), getDeliveryZones()]);
  const pages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const tabs = [
    { view: "all" as const, label: "All orders", count: null },
    { view: "attention" as const, label: "Needs attention", count: counts.attention ?? 0 },
    { view: "follow_up" as const, label: "Follow up", count: counts.follow_up ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md font-bold text-navy">Orders</h1>
        <a
          href={`/admin/orders/export${orderFiltersQuery({ ...f, page: 1 })}`}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-surface-high px-3 text-label-md font-bold text-navy"
        >
          <Icon name="download" className="text-base" /> Export CSV
        </a>
      </div>

      <nav aria-label="Order views" className="no-scrollbar flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.view}
            href={`/admin/orders${orderFiltersQuery({ view: t.view })}`}
            aria-current={f.view === t.view ? "page" : undefined}
            className={cn(
              "flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-label-md",
              f.view === t.view ? "bg-navy text-on-dark" : "bg-surface-container text-ink",
            )}
          >
            {t.label}
            {t.count !== null ? (
              <span className={cn("rounded-full px-1.5 text-label-sm", t.count > 0 ? "bg-gold-soft text-bronze-ink" : "bg-surface-high text-ink-muted")}>
                {t.count}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
      {f.view === "follow_up" ? (
        <p className="rounded-lg bg-gold-soft/30 px-3 py-2 text-body-sm text-bronze-ink">
          Unpaid orders still waiting for the customer in chat after {followUpHours} h. They auto-cancel (and release stock) {autoCancelHours} h
          after ordering — message them before then.
        </p>
      ) : null}

      <form method="get" className="grid grid-cols-2 gap-2 rounded-xl bg-card p-3 shadow-card sm:grid-cols-3 lg:grid-cols-7" aria-label="Filter orders">
        {f.view !== "all" ? <input type="hidden" name="view" value={f.view} /> : null}
        <label className="col-span-2 sm:col-span-3 lg:col-span-2">
          <span className="sr-only">Search orders</span>
          <Input name="q" defaultValue={f.q ?? ""} placeholder="Order no., name or phone" className="py-2" />
        </label>
        <label>
          <span className="sr-only">Status</span>
          <Select name="status" defaultValue={f.status ?? ""} className="py-2">
            <option value="">Any status</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Payment</span>
          <Select name="payment" defaultValue={f.payment ?? ""} className="py-2">
            <option value="">Any payment</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">State</span>
          <Select name="state" defaultValue={f.state ?? ""} className="py-2">
            <option value="">Any state</option>
            {zones.map((z) => (
              <option key={z.state} value={z.state}>
                {z.displayName}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col">
          <span className="text-label-sm text-ink-muted">From</span>
          <Input type="date" name="from" defaultValue={f.from ?? ""} className="py-1.5" />
        </label>
        <label className="flex flex-col">
          <span className="text-label-sm text-ink-muted">To</span>
          <Input type="date" name="to" defaultValue={f.to ?? ""} className="py-1.5" />
        </label>
        <div className="col-span-2 flex gap-2 sm:col-span-3 lg:col-span-7">
          <button type="submit" className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-navy px-4 text-label-md font-bold text-on-dark">
            <Icon name="filter_list" className="text-base" /> Apply
          </button>
          <Link href="/admin/orders" className="inline-flex min-h-10 items-center rounded-lg px-3 text-label-md text-navy">
            Clear
          </Link>
          <span className="ml-auto self-center text-body-sm text-ink-muted">
            {total.toLocaleString("en-NG")} order{total === 1 ? "" : "s"}
          </span>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon="receipt_long" title="No orders match" body="Try another view or clear the filters." />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="admin-orders">
          {rows.map((o) => {
            const balance = Math.max(o.totalKobo - o.amountPaidKobo, 0);
            const cancelAt = o.status === "awaiting_chat" && o.paymentStatus === "unpaid" ? autoCancelAt(o.createdAt, autoCancelHours) : null;
            return (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-xl bg-card p-3 shadow-card hover:shadow-raised",
                    (o.status === "awaiting_chat" || o.paymentStatus === "payment_claimed") && "border-l-4 border-gold",
                  )}
                  data-testid="admin-order-row"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-navy tabular">{o.orderNumber}</span>
                    <OrderStatusBadge status={o.status} />
                    <PaymentStatusBadge status={o.paymentStatus} />
                    {o.isDuplicateSuspect ? (
                      <Badge tone="redSoft" size="pill" icon="warning">
                        Possible duplicate
                      </Badge>
                    ) : null}
                    {o.isOverpaid ? (
                      <Badge tone="redSoft" size="pill">
                        Overpaid
                      </Badge>
                    ) : null}
                    <span className="ml-auto text-body-sm text-ink-muted" title={formatLagosDateTime(o.createdAt)}>
                      {timeAgo(o.createdAt)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-body-md">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold text-ink">{o.customerName}</span> · {formatNgPhoneLocal(o.phoneE164)} · {o.city}, {o.state}
                    </span>
                    <span className="font-bold text-navy-deep tabular">{formatNaira(o.totalKobo)}</span>
                  </span>
                  <span className="flex flex-wrap items-center justify-between gap-2 text-body-sm text-ink-muted">
                    <span className="min-w-0 truncate">{o.itemsSummary}</span>
                    <span className="flex items-center gap-2">
                      {o.chatClickedAt ? (
                        <span className="flex items-center gap-0.5 text-emerald-ink">
                          <Icon name="chat" className="text-sm" /> opened {o.chatChannel}
                        </span>
                      ) : (
                        <span>no chat click yet</span>
                      )}
                      {balance > 0 && o.amountPaidKobo > 0 ? <span>balance {formatNaira(balance)}</span> : null}
                      {o.dispatcherName ? <span>rider: {o.dispatcherName}</span> : null}
                    </span>
                  </span>
                  {cancelAt ? (
                    <span className="text-label-sm text-urgent-ink">Auto-cancels {formatLagosDateTime(cancelAt)} unless the customer pays or chats</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-center gap-2">
          {f.page > 1 ? (
            <Link href={`/admin/orders${orderFiltersQuery({ ...f, page: f.page - 1 })}`} className="min-h-10 rounded-lg bg-surface-high px-3 py-2 text-label-md">
              ← Newer
            </Link>
          ) : null}
          <span className="text-body-sm text-ink-muted">
            Page {f.page} of {pages}
          </span>
          {f.page < pages ? (
            <Link href={`/admin/orders${orderFiltersQuery({ ...f, page: f.page + 1 })}`} className="min-h-10 rounded-lg bg-surface-high px-3 py-2 text-label-md">
              Older →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
