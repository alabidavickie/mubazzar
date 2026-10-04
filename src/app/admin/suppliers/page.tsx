import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/session";
import { asUser } from "@/server/db";
import { formatNaira, koboToNairaInput } from "@/lib/money";
import { formatLagosDate } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { SubmissionDecision, SupplierDecision } from "@/components/admin/supplier-review";

export const metadata: Metadata = { title: "Suppliers" };

const TABS = ["pending", "approved", "rejected"] as const;

export default async function SuppliersAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await requireRole(["admin"], "/admin/suppliers");
  const sp = await searchParams;
  const status = (TABS as readonly string[]).includes(sp.status ?? "") ? sp.status! : "pending";
  const [apps, subs] = await asUser(session.userId, async (q) => [
    await q.query<{ id: string; businessName: string; contactName: string; phone: string; email: string; cac: string | null; categories: string[]; links: string[]; message: string | null; createdAt: string; products: number }>(
      `select s.id, s.business_name as "businessName", s.contact_name as "contactName", s.phone_e164 as phone, s.email, s.cac_number as cac,
              s.categories, s.sample_links as links, s.message, s.created_at as "createdAt",
              (select count(*)::int from public.products p where p.supplier_id = s.id) as products
         from public.suppliers s where s.status = $1::public.supplier_status order by s.created_at desc limit 100`,
      [status],
    ),
    await q.query<{ id: string; name: string; description: string; proposedKobo: number; compareKobo: number | null; stock: number; images: string[]; supplier: string; createdAt: string }>(
      `select sp.id, sp.name, sp.description, sp.proposed_price_kobo as "proposedKobo", sp.compare_at_kobo as "compareKobo", sp.stock_available as stock,
              sp.image_urls as images, s.business_name as supplier, sp.created_at as "createdAt"
         from public.supplier_products sp join public.suppliers s on s.id = sp.supplier_id
        where sp.status = 'pending' order by sp.created_at`,
    ),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-headline-md font-bold text-navy">Suppliers</h1>
      <section className="flex flex-col gap-2" aria-label="Products waiting for review">
        <h2 className="text-label-lg font-bold text-navy">Products waiting for review ({subs.length})</h2>
        {subs.map((s) => (
          <article key={s.id} className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-card" data-testid="submission-row">
            <div className="flex gap-3">
              {s.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                <img src={s.images[0]} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
              ) : null}
              <div className="min-w-0">
                <p className="font-semibold text-ink">{s.name}</p>
                <p className="text-body-sm text-ink-muted">
                  {s.supplier} · proposed {formatNaira(Number(s.proposedKobo))}
                  {s.compareKobo ? ` (was ${formatNaira(Number(s.compareKobo))})` : ""} · {s.stock} units · {s.images.length} photo{s.images.length === 1 ? "" : "s"}
                </p>
                <p className="line-clamp-2 text-body-sm">{s.description}</p>
              </div>
            </div>
            <SubmissionDecision id={s.id} name={s.name} proposed={koboToNairaInput(Number(s.proposedKobo))} />
          </article>
        ))}
      </section>
      <nav aria-label="Application status" className="flex gap-2">
        {TABS.map((t) => (
          <Link key={t} href={`/admin/suppliers?status=${t}`} aria-current={t === status ? "page" : undefined} className={cn("min-h-10 rounded-full px-3.5 py-2 text-label-md capitalize", t === status ? "bg-navy text-on-dark" : "bg-surface-container text-ink")}>
            {t}
          </Link>
        ))}
      </nav>
      <ul className="flex flex-col gap-2">
        {apps.length === 0 ? <li className="text-body-md text-ink-muted">No {status} applications.</li> : null}
        {apps.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-card" data-testid="supplier-row">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{a.businessName}</span>
              {a.cac ? <Badge size="xs" tone="emeraldSoft">CAC {a.cac}</Badge> : <Badge size="xs">No CAC yet</Badge>}
              <span className="ml-auto text-body-sm text-ink-muted">{formatLagosDate(a.createdAt)}</span>
            </div>
            <p className="text-body-sm text-ink-muted">
              {a.contactName} · {a.phone} · {a.email}
              {a.categories.length ? ` · ${a.categories.join(", ")}` : ""} · {a.products} live product{a.products === 1 ? "" : "s"}
            </p>
            {a.message ? <p className="text-body-sm">{a.message}</p> : null}
            {a.links.length ? (
              <p className="flex flex-wrap gap-2 text-body-sm">
                {a.links.map((l) => (
                  <a key={l} href={l} target="_blank" rel="noopener noreferrer nofollow" className="text-navy underline">
                    {new URL(l).hostname}
                  </a>
                ))}
              </p>
            ) : null}
            {status === "pending" ? <SupplierDecision id={a.id} name={a.businessName} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
