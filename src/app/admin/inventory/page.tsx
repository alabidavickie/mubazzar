import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { listInventory } from "@/server/services/admin-inventory";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { Icon } from "@/components/icons/icon";
import { InventoryCellEditor } from "@/components/admin/inventory-cell";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Inventory" };

type Search = Promise<{ q?: string; low?: string }>;

export default async function InventoryPage({ searchParams }: { searchParams: Search }) {
  const session = await requireRole(["admin"], "/admin/inventory");
  const sp = await searchParams;
  const lowOnly = sp.low === "1";
  const { hubs, rows } = await listInventory(session, { q: sp.q ?? null, lowOnly });
  const lowCount = rows.filter((r) => r.low).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md font-bold text-navy">Inventory</h1>
        <p className="text-body-sm text-ink-muted">Reserved = held for open orders. Delivered orders deduct on-hand.</p>
      </div>
      <form method="get" className="flex flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search products</span>
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search products" className="py-2" />
        </label>
        {lowOnly ? <input type="hidden" name="low" value="1" /> : null}
        <button type="submit" className="min-h-10 rounded-lg bg-navy px-4 text-label-md font-bold text-on-dark">
          Search
        </button>
        <Link
          href={lowOnly ? "/admin/inventory" : "/admin/inventory?low=1"}
          className={cn("inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-label-md", lowOnly ? "bg-urgent text-on-dark" : "bg-urgent-soft text-urgent-ink")}
        >
          <Icon name="warning" className="text-base" /> Low stock only
        </Link>
      </form>
      {lowOnly && lowCount === 0 ? <p className="text-body-md text-emerald-ink">Nothing is low on stock. 🎉</p> : null}
      <div className="overflow-x-auto rounded-xl bg-card shadow-card" tabIndex={0} role="region" aria-label="Stock per hub">
        <table className="w-full min-w-[640px] text-body-md">
          <thead>
            <tr className="border-b border-line text-left text-label-sm text-ink-muted uppercase">
              <th className="p-2">Product</th>
              {hubs.map((h) => (
                <th key={h.id} className="p-2">
                  {h.name}
                </th>
              ))}
              <th className="p-2 text-right">Can ship</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.productId} className="border-b border-line align-top" data-testid="inventory-row" data-slug={r.slug}>
                <td className="p-2">
                  <span className="font-semibold text-ink">{r.name}</span>
                  <span className="flex flex-wrap gap-1 pt-0.5">
                    {!r.isActive ? <Badge size="xs">Hidden</Badge> : null}
                    {r.low ? (
                      <Badge tone="redSoft" size="xs" icon="warning">
                        Low stock
                      </Badge>
                    ) : null}
                  </span>
                </td>
                {r.cells.map((c) => (
                  <td key={c.hubId} className="p-1">
                    <InventoryCellEditor productId={r.productId} productName={r.name} {...c} />
                  </td>
                ))}
                <td className="p-2 text-right font-bold tabular" data-testid="total-available">
                  {r.totalAvailable}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
