import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { asUser } from "@/server/db";
import { formatLagosDate } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { ReviewActions } from "@/components/admin/admin-records";

export const metadata: Metadata = { title: "Reviews" };

const TABS = ["pending", "approved", "rejected"] as const;

export default async function ReviewsAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await requireRole(["admin"], "/admin/reviews");
  const sp = await searchParams;
  const status = (TABS as readonly string[]).includes(sp.status ?? "") ? sp.status! : "pending";
  const rows = await asUser(session.userId, (q) =>
    q.query<{ id: string; author: string; location: string | null; rating: number; body: string; isSample: boolean; verified: boolean; product: string; createdAt: string; status: string }>(
      `select r.id, r.author_name as author, r.location, r.rating, r.body, r.is_sample as "isSample", r.is_verified_purchase as verified,
              p.name as product, r.created_at as "createdAt", r.status
         from public.reviews r join public.products p on p.id = r.product_id
        where r.status = $1::public.review_status order by r.created_at desc limit 100`,
      [status],
    ),
  );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-headline-md font-bold text-navy">Reviews</h1>
      <nav aria-label="Review status" className="flex gap-2">
        {TABS.map((t) => (
          <Link key={t} href={`/admin/reviews?status=${t}`} aria-current={t === status ? "page" : undefined} className={cn("min-h-10 rounded-full px-3.5 py-2 text-label-md capitalize", t === status ? "bg-navy text-on-dark" : "bg-surface-container text-ink")}>
            {t}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? <p className="text-body-md text-ink-muted">Nothing here.</p> : null}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-1.5 rounded-xl bg-card p-3 shadow-card" data-testid="review-row">
            <span className="flex flex-wrap items-center gap-2 text-body-sm">
              <span className="font-semibold text-ink">{r.author}</span>
              {r.location ? <span className="text-ink-muted">· {r.location}</span> : null}
              <span aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}</span>
              {r.verified ? <Badge tone="emeraldSoft" size="xs">Verified purchase</Badge> : null}
              {r.isSample ? <Badge size="xs">Sample</Badge> : null}
              <span className="ml-auto text-ink-muted">{r.product} · {formatLagosDate(r.createdAt)}</span>
            </span>
            <p className="text-body-md">{r.body}</p>
            <ReviewActions id={r.id} status={r.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
