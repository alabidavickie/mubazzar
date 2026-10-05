import Link from "next/link";
import { requireRole } from "@/server/session";
import { getSupplierDashboard } from "@/server/services/supplier";
import { formatNaira } from "@/lib/money";
import { formatLagosDate } from "@/lib/time";
import { Icon } from "@/components/icons/icon";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Dashboard" };

const TONE = { draft: "neutral", pending: "gold", approved: "emerald", rejected: "redSoft" } as const;

export default async function SupplierHome() {
  const session = await requireRole(["supplier"], "/supplier");
  const d = await getSupplierDashboard(session);
  if (!d) return <p className="text-body-md">No supplier profile is linked to this account. Please contact MUBAZZAR.</p>;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md font-bold text-navy">{d.supplier.businessName}</h1>
        <Link href="/supplier/products/new" className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-navy px-4 text-label-md font-bold text-on-dark">
          <Icon name="add" /> Submit a product
        </Link>
      </div>
      <section aria-label="Live products" className="flex flex-col gap-2">
        <h2 className="text-label-lg font-bold text-navy">Your live products</h2>
        {d.products.length === 0 ? <p className="text-body-md text-ink-muted">None yet — approved submissions appear here.</p> : null}
        <ul className="flex flex-col gap-2" data-testid="supplier-products">
          {d.products.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-3 shadow-card">
              <span className="min-w-0 flex-1">
                <a href={`/p/${p.slug}`} target="_blank" rel="noopener" className="font-semibold text-navy underline-offset-2 hover:underline">
                  {p.name}
                </a>
                <span className="block text-body-sm text-ink-muted">
                  {formatNaira(Number(p.priceKobo))} · {p.isActive ? "live" : "hidden"}
                </span>
              </span>
              <span className="text-body-sm tabular">{p.available} in stock</span>
              <span className="text-body-sm tabular">{p.unitsSold} sold</span>
              <span className="text-body-sm tabular">{p.unitsOpen} in open orders</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Submissions" className="flex flex-col gap-2">
        <h2 className="text-label-lg font-bold text-navy">Submissions</h2>
        <ul className="flex flex-col gap-2" data-testid="supplier-submissions">
          {d.submissions.map((s) => (
            <li key={s.id}>
              <Link href={`/supplier/products/${s.id}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-3 shadow-card">
                <span className="min-w-0 flex-1 font-semibold text-ink">{s.name}</span>
                <Badge tone={TONE[s.status as keyof typeof TONE] ?? "neutral"} size="pill">
                  {s.status}
                </Badge>
                <span className="text-body-sm text-ink-muted">
                  {formatNaira(Number(s.proposedKobo))} · {formatLagosDate(s.updatedAt)}
                </span>
                {s.reviewNote ? <span className="w-full text-body-sm text-ink-muted">Note: {s.reviewNote}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
