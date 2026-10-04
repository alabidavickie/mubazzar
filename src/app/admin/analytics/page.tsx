import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { getAnalytics } from "@/server/services/admin-analytics";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/admin-orders";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Analytics" };

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-card p-3 shadow-card">
      <span className="text-label-sm text-ink-muted uppercase">{label}</span>
      <span className="text-headline-sm font-extrabold text-navy-deep tabular">{value}</span>
      {sub ? <span className="text-body-sm text-ink-muted">{sub}</span> : null}
    </div>
  );
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <section className="overflow-x-auto rounded-xl bg-card shadow-card" tabIndex={0} role="region" aria-label={title}>
      <h2 className="p-3 pb-1 text-label-lg font-bold text-navy">{title}</h2>
      {rows.length === 0 ? (
        <p className="p-3 pt-0 text-body-sm text-ink-muted">No data yet.</p>
      ) : (
        <table className="w-full text-body-md">
          <thead>
            <tr className="border-b border-line text-left text-label-sm text-ink-muted uppercase">
              {head.map((h, i) => (
                <th key={h} className={cn("p-2", i > 0 && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {r.map((c, j) => (
                  <td key={j} className={cn("p-2", j > 0 && "text-right tabular")}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await requireRole(["admin"], "/admin/analytics");
  const d = Number((await searchParams).days);
  const days = [7, 30, 90].includes(d) ? d : 30;
  const a = await getAnalytics(session, days);
  const t = a.totals;
  const closed = t.delivered + t.failed;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md font-bold text-navy">Analytics</h1>
        <nav aria-label="Period" className="flex gap-1">
          {[7, 30, 90].map((n) => (
            <Link key={n} href={`/admin/analytics?days=${n}`} aria-current={n === days ? "page" : undefined} className={cn("min-h-10 rounded-full px-3 py-2 text-label-md", n === days ? "bg-navy text-on-dark" : "bg-surface-container")}>
              {n} days
            </Link>
          ))}
        </nav>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="analytics-tiles">
        <Tile label="Orders" value={String(t.orders)} />
        <Tile label="Verified revenue" value={formatNaira(t.verifiedRevenueKobo)} sub="Payments recorded minus refunds" />
        <Tile label="Order → chat" value={pct(t.chatClicked, t.orders)} sub={`${t.chatClicked} opened chat`} />
        <Tile label="Chat → paid" value={pct(t.paidOrDelivered, t.chatClicked)} sub={`${t.paidOrDelivered} paid or delivered`} />
        <Tile label="Unpaid, awaiting chat" value={String(t.unpaidOpen)} sub={`${t.autoCancelled} auto-cancelled`} />
        <Tile label="Delivery success" value={pct(t.delivered, closed)} sub={`${t.delivered} delivered · ${t.failed} failed`} />
        <Tile label="Avg first response" value={t.avgFirstResponseMinutes === null ? "—" : `${t.avgFirstResponseMinutes} min`} sub="Order placed → staff first status change" />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Table title="Orders by status" head={["Status", "Orders"]} rows={a.byStatus.map((r) => [ORDER_STATUS_LABEL[r.status as OrderStatus] ?? r.status, r.n])} />
        <Table title="By chat channel" head={["Channel", "Orders", "Opened chat", "Paid"]} rows={a.byChannel.map((r) => [r.channel, r.orders, pct(r.clicked, r.orders), pct(r.paid, r.orders)])} />
        <Table title="Top products" head={["Product", "Units", "Revenue"]} rows={a.topProducts.map((r) => [r.name, r.units, formatNaira(r.revenueKobo)])} />
        <Table title="Top states" head={["State", "Orders", "Paid"]} rows={a.topStates.map((r) => [r.state, r.orders, pct(r.paid, r.orders)])} />
        <Table title="Landing pages" head={["Page", "Views", "Orders", "Conv.", "Paid"]} rows={a.landing.map((r) => [`/lp/${r.slug}`, r.views, r.orders, pct(r.orders, r.views), r.paid])} />
        <Table title="UTM campaigns" head={["Campaign", "Orders", "Paid", "Paid revenue"]} rows={a.campaigns.map((r) => [r.campaign, r.orders, r.paid, formatNaira(r.revenueKobo)])} />
      </div>
    </div>
  );
}
