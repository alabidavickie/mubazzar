import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { listAdminProducts } from "@/server/services/admin-catalog";
import { formatNaira } from "@/lib/money";
import { Icon } from "@/components/icons/icon";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireRole(["admin"], "/admin/products");
  const { q } = await searchParams;
  const rows = await listAdminProducts(session, q ?? null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md font-bold text-navy">Products</h1>
        <Link href="/admin/products/new" className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-navy px-4 text-label-md font-bold text-on-dark">
          <Icon name="add" /> New product
        </Link>
      </div>
      <form method="get" className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Search products</span>
          <Input name="q" defaultValue={q ?? ""} placeholder="Search by name, slug or SKU" className="py-2" />
        </label>
        <button type="submit" className="min-h-10 rounded-lg bg-navy px-4 text-label-md font-bold text-on-dark">
          Search
        </button>
      </form>
      {rows.length === 0 ? (
        <EmptyState icon="inventory_2" title="No products found" />
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2" data-testid="admin-products">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-card hover:shadow-raised" data-testid="admin-product-row">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                  <img src={p.imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-surface-high text-ink-muted">
                    <Icon name="image" />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-ink">{p.name}</span>
                  <span className="text-body-sm text-ink-muted">
                    {formatNaira(p.priceKobo)} · {p.categoryName ?? "No category"} · {p.available} can ship · {p.bundleCount} bundle{p.bundleCount === 1 ? "" : "s"}
                  </span>
                </span>
                {!p.isActive ? <Badge size="xs">Hidden</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
