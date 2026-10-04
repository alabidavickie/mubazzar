import type { Metadata } from "next";
import { requireRole } from "@/server/session";
import { asUser } from "@/server/db";
import { formatNaira, koboToNairaInput } from "@/lib/money";
import { formatLagosDateTime, utcToLagosLocal } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { FlashDealForm } from "@/components/admin/flash-deal-form";

export const metadata: Metadata = { title: "Flash deals" };

interface DealRow {
  id: string;
  productId: string;
  productName: string;
  regularKobo: number;
  dealKobo: number;
  title: string | null;
  promoText: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export default async function FlashDealsPage() {
  const session = await requireRole(["admin"], "/admin/flash-deals");
  const [deals, products] = await asUser(session.userId, async (q) => [
    await q.query<DealRow>(
      `select fd.id, fd.product_id as "productId", p.name as "productName", p.price_kobo as "regularKobo", fd.deal_price_kobo as "dealKobo",
              fd.title, fd.promo_text as "promoText", fd.starts_at as "startsAt", fd.ends_at as "endsAt", fd.is_active as "isActive"
         from public.flash_deals fd join public.products p on p.id = fd.product_id
        order by (fd.is_active and fd.ends_at > now()) desc, fd.starts_at desc limit 100`,
    ),
    await q.query<{ id: string; name: string; priceKobo: number }>(`select id, name, price_kobo as "priceKobo" from public.products where is_active order by name`),
  ]);
  const options = products.map((p) => ({ id: p.id, name: p.name, price: formatNaira(Number(p.priceKobo)) }));
  const now = new Date().getTime();
  const tomorrow = new Date(now + 86_400_000);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-headline-md font-bold text-navy">Flash deals</h1>
      <p className="text-body-md text-ink-muted">
        The deal price is charged only between the start and end times; the homepage countdown counts to the real end. After it ends the
        regular price applies automatically.
      </p>
      <section className="rounded-xl bg-card p-4 shadow-card" aria-label="New flash deal">
        <h2 className="mb-2 text-label-lg font-bold text-navy">New deal</h2>
        <FlashDealForm initial={{ productId: "", dealPrice: "", startsAt: utcToLagosLocal(new Date(now)), endsAt: utcToLagosLocal(tomorrow), isActive: true }} products={options} submitLabel="Create deal" />
      </section>
      <ul className="flex flex-col gap-2" data-testid="flash-deals">
        {deals.map((d) => {
          const start = new Date(d.startsAt).getTime();
          const end = new Date(d.endsAt).getTime();
          const state = !d.isActive ? "Off" : now < start ? "Upcoming" : now < end ? "Live" : "Ended";
          return (
            <li key={d.id} className="rounded-xl bg-card p-3 shadow-card">
              <details>
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{d.productName}</span>
                  <Badge tone={state === "Live" ? "emerald" : state === "Upcoming" ? "gold" : "neutral"} size="pill">
                    {state}
                  </Badge>
                  <span className="text-body-sm text-ink-muted">
                    {formatNaira(Number(d.dealKobo))} (was {formatNaira(Number(d.regularKobo))}) · {formatLagosDateTime(d.startsAt)} → {formatLagosDateTime(d.endsAt)}
                  </span>
                </summary>
                <div className="pt-3">
                  <FlashDealForm
                    initial={{
                      id: d.id,
                      productId: d.productId,
                      title: d.title ?? "",
                      promoText: d.promoText ?? "",
                      dealPrice: koboToNairaInput(Number(d.dealKobo)),
                      startsAt: utcToLagosLocal(d.startsAt),
                      endsAt: utcToLagosLocal(d.endsAt),
                      isActive: d.isActive,
                    }}
                    products={options}
                    submitLabel="Save deal"
                  />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
