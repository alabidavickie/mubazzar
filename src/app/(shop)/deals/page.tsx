import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Countdown } from "@/components/commerce/countdown";
import { ProductCard } from "@/components/commerce/product-card";
import { EmptyState, SectionHeader } from "@/components/ui/misc";
import { getActiveFlashDeals, listProducts, maxActiveDiscountPercent } from "@/server/services/catalog";
import { getPublicSettings } from "@/server/services/settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Flash Deals & Biggest Discounts",
  description:
    "Today's MUBAZZAR flash deals with real end times, plus the biggest discounts on tested gadgets. Same-day delivery in Lagos & Abuja.",
  alternates: { canonical: "/deals" },
};

const iso = (v: string | Date) => new Date(v).toISOString();

export default async function DealsPage() {
  const [deals, discounted, maxDiscount, settings] = await Promise.all([
    getActiveFlashDeals(),
    listProducts({ sort: "discount", limit: 12 }),
    maxActiveDiscountPercent(),
    getPublicSettings(),
  ]);
  const serverNow = new Date().toISOString();
  const ends = deals.map((d) => iso(d.endsAt));
  const soonest = ends.length ? [...ends].sort()[0]! : null;
  const mixedEnds = new Set(ends).size > 1;
  const dealIds = new Set(deals.map((d) => d.id));
  const biggest = discounted.items.filter((p) => !dealIds.has(p.id) && p.compareAtKobo && p.compareAtKobo > p.priceKobo);

  return (
    <div className="flex flex-col gap-2">
      {/* Heading */}
      <div className="px-4 pt-3">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-navy-deep via-navy to-navy-deep p-4 text-on-dark shadow-raised">
          <div aria-hidden className="pointer-events-none absolute -right-8 -bottom-8 size-36 rounded-full bg-gold-soft/10 blur-2xl" />
          <span className="relative inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-label-sm font-extrabold tracking-wider text-bronze-ink uppercase">
            <Icon name="local_fire_department" className="text-xs" /> Hot Deals
          </span>
          <h1 className="relative mt-1.5 font-display text-headline-xl font-bold">
            {maxDiscount > 0 ? (
              <>
                Save up to <span className="text-gold-pale">{maxDiscount}%</span> today
              </>
            ) : (
              "Today's deals"
            )}
          </h1>
          <p className="relative text-body-sm text-on-dark-muted">
            Real prices, real end times. Order now and pay in chat — Pay on Delivery can be arranged.
          </p>
        </div>
      </div>

      {/* Flash deals */}
      <section className="bg-surface-low px-4 py-4" aria-labelledby="flash-title" data-testid="deals-flash">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-gold-soft text-bronze-ink">
              <Icon name="flash_on" className="text-lg" />
            </span>
            <div>
              <h2 id="flash-title" className="text-headline-sm font-bold text-navy">
                {settings.flashSection.title}
              </h2>
              <p className="text-label-sm text-ink-muted">
                {deals.length ? "Prices end when the timer hits zero" : "No flash deal is running right now"}
              </p>
            </div>
          </div>
          {soonest && !mixedEnds ? <Countdown endsAt={soonest} serverNow={serverNow} label="Deals end in" /> : null}
        </div>
        {deals.length ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {deals.map((d, i) => (
              <li key={d.dealId} className="flex min-w-0">
                <ProductCard
                  product={d}
                  priority={i < 2}
                  ctaLabel="Quick Order"
                  ctaIcon="shopping_cart_checkout"
                  className="w-full"
                  imageOverlay={
                    mixedEnds ? (
                      <span className="absolute right-1.5 bottom-1.5 left-1.5 flex items-center justify-center gap-1 rounded bg-navy/85 px-1.5 py-0.5 text-[0.6875rem] text-gold-pale backdrop-blur-sm">
                        <Icon name="timer" className="text-xs" />
                        <Countdown endsAt={iso(d.endsAt)} serverNow={serverNow} variant="inline" label="Ends in" />
                      </span>
                    ) : d.promoText ? (
                      <span className="absolute right-1.5 bottom-1.5 left-1.5 truncate rounded bg-navy/85 px-1.5 py-0.5 text-center text-[0.6875rem] font-bold text-gold-pale backdrop-blur-sm">
                        {d.promoText}
                      </span>
                    ) : null
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="schedule"
            title="The next flash deal is loading"
            body="We only run deals with real end times. Meanwhile, these products already carry their biggest discounts."
          />
        )}
        {deals.some((d) => d.lowStockUnits) ? (
          <ul className="mt-2 flex flex-col gap-1">
            {deals
              .filter((d) => d.lowStockUnits)
              .map((d) => (
                <li key={d.dealId} className="flex items-center gap-1 text-label-sm text-urgent">
                  <Icon name="warning" className="text-sm" /> Only {d.lowStockUnits} left in one of our hubs: {d.name}
                </li>
              ))}
          </ul>
        ) : null}
      </section>

      {/* Biggest discounts */}
      {biggest.length ? (
        <section className="px-4 py-2" aria-labelledby="biggest-title">
          <SectionHeader
            title={<span id="biggest-title">Biggest Discounts</span>}
            subtitle="Sorted by real saving off the compare-at price"
            action={
              <Link href="/shop?sort=discount" className="flex min-h-11 items-center text-label-md font-bold text-bronze">
                See all <Icon name="chevron_right" className="text-base" />
              </Link>
            }
          />
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {biggest.map((p) => (
              <li key={p.id} className="flex min-w-0">
                <ProductCard product={p} className="w-full" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
