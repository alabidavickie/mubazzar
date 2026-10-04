import Link from "next/link";
import { requireRole } from "@/server/session";
import { listMyDeliveries, type DispatchListRow } from "@/server/services/dispatch";
import { formatNaira } from "@/lib/money";
import { formatLagosDateTime } from "@/lib/time";
import { Icon } from "@/components/icons/icon";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "My deliveries" };

function Row({ o }: { o: DispatchListRow }) {
  const balance = Math.max(o.totalKobo - o.amountPaidKobo, 0);
  return (
    <li>
      <Link href={`/dispatch/${o.id}`} className="flex flex-col gap-1 rounded-xl bg-card p-4 shadow-card active:scale-[0.99]" data-testid="delivery-row">
        <span className="flex items-center justify-between gap-2">
          <span className="font-bold text-navy tabular">{o.orderNumber}</span>
          {o.assignmentStatus === "assigned" ? (
            balance > 0 ? (
              <Badge tone="gold" size="pill">
                Collect {formatNaira(balance)}
              </Badge>
            ) : (
              <Badge tone="emeraldSoft" size="pill">
                Paid — nothing to collect
              </Badge>
            )
          ) : (
            <Badge tone={o.assignmentStatus === "delivered" ? "emerald" : "redSoft"} size="pill">
              {o.assignmentStatus}
            </Badge>
          )}
        </span>
        <span className="text-body-lg font-semibold text-ink">{o.customerName}</span>
        <span className="text-body-md text-ink-muted">
          {o.address}, {o.city}
          {o.landmark ? ` · ${o.landmark}` : ""}
        </span>
        <span className="text-body-sm text-ink-muted">
          {o.itemsSummary} · assigned {formatLagosDateTime(o.assignedAt)}
        </span>
      </Link>
    </li>
  );
}

export default async function DispatchHome() {
  const session = await requireRole(["dispatcher"], "/dispatch");
  const { active, recent } = await listMyDeliveries(session);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-2 text-headline-md font-bold text-navy">
        <Icon name="two_wheeler" /> To deliver ({active.length})
      </h1>
      {active.length === 0 ? (
        <EmptyState icon="local_shipping" title="No deliveries assigned" body="New assignments from the office show up here." />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="active-deliveries">
          {active.map((o) => (
            <Row key={o.id} o={o} />
          ))}
        </ul>
      )}
      {recent.length > 0 ? (
        <>
          <h2 className="text-label-lg font-bold text-navy">Last 3 days</h2>
          <ul className="flex flex-col gap-3">
            {recent.map((o) => (
              <Row key={`${o.id}-${o.assignmentStatus}`} o={o} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
