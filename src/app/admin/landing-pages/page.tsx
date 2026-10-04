import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { listLandingPages } from "@/server/services/admin-landing";
import { markupToPlainText } from "@/lib/markup";
import { Icon } from "@/components/icons/icon";
import { EmptyState } from "@/components/ui/misc";
import { PublishToggle } from "@/components/admin/publish-toggle";

export const metadata: Metadata = { title: "Landing pages" };

export default async function LandingPagesAdmin() {
  const session = await requireRole(["admin"], "/admin/landing-pages");
  const rows = await listLandingPages(session);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-headline-md font-bold text-navy">Ad landing pages</h1>
        <Link href="/admin/landing-pages/new" className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-navy px-4 text-label-md font-bold text-on-dark">
          <Icon name="add" /> New landing page
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="campaign" title="No landing pages yet" body="Create one per product you advertise." />
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
    </div>
  );
}
