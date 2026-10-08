import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { listLandingPages, listProductLandingPages, PRODUCT_LANDING_LIMIT } from "@/server/services/admin-landing";
import { markupToPlainText } from "@/lib/markup";
import { Icon } from "@/components/icons/icon";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { PublishToggle } from "@/components/admin/publish-toggle";

export const metadata: Metadata = { title: "Landing pages" };

export default async function LandingPagesAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireRole(["admin"], "/admin/landing-pages");
  const { q } = await searchParams;
  const [rows, products] = await Promise.all([listLandingPages(session), listProductLandingPages(session, q ?? null)]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md font-bold text-navy">Ad landing pages</h1>
        <Link href="/admin/landing-pages/new" className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-navy px-4 text-label-md font-bold text-on-dark">
          <Icon name="add" /> New landing page
        </Link>
      </div>
      <p className="rounded-xl bg-card p-3 text-body-md text-ink shadow-card">
        <b>Every product already has its own landing page</b> at <code>/lp/&lt;product link&gt;</code>, built from the product&apos;s photos, price, packages, features,
        reviews and order form — nothing to set up. Use <b>Customize</b> to make a custom page for a product when you want your own headline, video or trust blocks;
        once published it replaces the automatic one at the same address.
      </p>
      <h2 className="text-label-lg font-bold text-navy">Custom pages ({rows.length})</h2>
      {rows.length === 0 ? (
        <p className="text-body-md text-ink-muted" data-testid="no-custom-pages">No custom pages yet — the automatic pages below are already live.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="admin-landing-pages">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3 shadow-card" data-testid="landing-row" data-slug={r.slug}>
              <Link href={`/admin/landing-pages/${r.id}`} className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold text-ink">{markupToPlainText(r.headline)}</span>
                <span className="text-body-sm text-ink-muted">
                  /lp/{r.slug} · {r.productName}
                  {r.productActive ? "" : " (product hidden)"} · {r.orders} order{r.orders === 1 ? "" : "s"}
                </span>
              </Link>
              <a href={`/lp/${r.slug}${r.isPublished ? "" : "?preview=1"}`} target="_blank" rel="noopener" className="text-label-md text-navy underline">
                {r.isPublished ? "Open" : "Preview"}
              </a>
              <PublishToggle id={r.id} published={r.isPublished} slug={r.slug} />
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Every product" className="flex flex-col gap-3">
        <h2 className="text-label-lg font-bold text-navy">
          Every product ({products.total}){products.total > PRODUCT_LANDING_LIMIT ? ` — showing the first ${PRODUCT_LANDING_LIMIT}, search to narrow` : ""}
        </h2>
        <form method="get" className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">Search products</span>
            <Input name="q" defaultValue={q ?? ""} placeholder="Search by product name or link" className="py-2" />
          </label>
          <button type="submit" className="min-h-10 rounded-lg bg-navy px-4 text-label-md font-bold text-on-dark">
            Search
          </button>
        </form>
        <ul className="flex flex-col gap-2" data-testid="product-landing-pages">
          {products.rows.map((p) => {
            const published = p.custom.find((c) => c.published);
            const draft = !published ? p.custom[0] : undefined;
            return (
              <li key={p.productId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-card p-3 shadow-card" data-testid="product-landing-row" data-slug={p.productSlug}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-ink">{p.productName}</span>
                  <span className="text-body-sm text-ink-muted">
                    /lp/{p.productSlug}
                    {published && published.slug !== p.productSlug ? ` · custom page at /lp/${published.slug}` : ""}
                  </span>
                </span>
                {!p.productActive ? (
                  <Badge size="xs">Product hidden — no page</Badge>
                ) : published ? (
                  <Badge size="xs" tone="emerald" data-testid="lp-kind">Custom · published</Badge>
                ) : draft ? (
                  <Badge size="xs" data-testid="lp-kind">Automatic · custom draft</Badge>
                ) : (
                  <Badge size="xs" data-testid="lp-kind">Automatic</Badge>
                )}
                {p.productActive ? (
                  <a href={`/lp/${p.productSlug}`} target="_blank" rel="noopener" className="text-label-md text-navy underline">
                    Open
                  </a>
                ) : null}
                {published || draft ? (
                  <Link href={`/admin/landing-pages/${(published ?? draft)!.id}`} className="text-label-md font-bold text-navy underline">
                    Edit custom page
                  </Link>
                ) : (
                  <Link href={`/admin/landing-pages/new?product=${p.productId}`} className="text-label-md font-bold text-navy underline">
                    Customize
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
