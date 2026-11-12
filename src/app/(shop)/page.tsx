import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Countdown } from "@/components/commerce/countdown";
import { ProductCard, ProductRow } from "@/components/commerce/product-card";
import { ReviewCard } from "@/components/commerce/review-card";
import { SectionHeader } from "@/components/ui/misc";
import { Stars } from "@/components/commerce/rating";
import { formatNaira } from "@/lib/money";
import { cx } from "@/lib/cx";
import {
  getActiveFlashDeals,
  getCategories,
  getCuratedProducts,
  getRecentReviews,
  maxActiveDiscountPercent,
} from "@/server/services/catalog";
import { getPublicSettings } from "@/server/services/settings";

export const revalidate = 60;

function fillMaxDiscount(text: string, pct: number): string {
  return text.replace(/\{max_discount\}/g, String(pct));
}

export default async function HomePage() {
  const [settings, categories, deals, curated, reviews, maxDiscount] = await Promise.all([
    getPublicSettings(),
    getCategories(),
    getActiveFlashDeals(),
    getCuratedProducts(6),
    getRecentReviews({ limit: 8 }),
    maxActiveDiscountPercent(),
  ]);
  const serverNow = new Date().toISOString();
  const hero = settings.hero;
  const headline = fillMaxDiscount(hero.headline, maxDiscount);
  const highlight = fillMaxDiscount(hero.highlight, maxDiscount);
  const [before, after] = highlight && headline.includes(highlight) ? headline.split(highlight) : [headline, ""];
  const dealsEnd = deals.length ? deals.map((d) => d.endsAt).sort()[0]! : null;
  const fewDeals = deals.length <= 2;
  // The default button points at /deals; with no deal running that page lists the biggest real discounts.
  const ctaLabel = deals.length === 0 && hero.ctaHref === "/deals" ? "See the Biggest Discounts" : hero.ctaLabel;

  // Real products with photos for the hero collage: live deals first, then curated picks.
  const seen = new Set<string>();
  const heroPicks = [...deals, ...curated]
    .filter((p) => p.imageUrl && !seen.has(p.slug) && seen.add(p.slug))
    .slice(0, 3);

  return (
    <>
      <h1 className="sr-only">MUBAZZAR — uncommon gadgets and viral problem solvers delivered across Nigeria</h1>

      {/* Hero: the offer, search and real products in one block */}
      <section className="px-4 pt-3 pb-2" aria-labelledby="hero-title">
        <div className="relative overflow-hidden rounded-2xl bg-navy-deep text-on-dark shadow-raised">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(var(--color-gold-pale)_1px,transparent_1px)] [background-size:18px_18px]"
          />
          <div className="relative grid gap-6 p-5 md:p-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-10 lg:p-10">
            <div className="flex flex-col gap-3">
              {/* Honesty rule: "flash sale / limited stock" only while a real deal is running. */}
              {deals.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-label-sm text-bronze-ink">
                    <Icon name="bolt" className="text-xs" /> {hero.badge}
                  </span>
                  {hero.badgeNote ? <span className="text-label-sm text-gold-pale">{hero.badgeNote}</span> : null}
                </div>
              ) : null}
              <h2 id="hero-title" className="font-display text-display leading-[1.08] font-bold text-on-dark lg:text-display-xl lg:font-extrabold">
                {before}
                {highlight && after !== undefined ? <span className="text-gold-soft">{highlight}</span> : null}
                {after}
              </h2>
              {hero.subtext ? <p className="max-w-md text-body-lg text-on-dark-muted">{hero.subtext}</p> : null}

              <form action="/search" role="search" className="mt-1 max-w-md">
                <label htmlFor="home-search" className="sr-only">
                  Search products
                </label>
                <div className="flex items-center rounded-xl bg-card text-ink shadow-card focus-within:ring-2 focus-within:ring-gold">
                  <Icon name="search" className="ml-3 text-xl text-ink-subtle" />
                  <input
                    id="home-search"
                    name="q"
                    type="search"
                    enterKeyHint="search"
                    placeholder="Search car tech, kitchen hacks, solar…"
                    className="w-full bg-transparent py-3.5 pr-3 pl-2 text-body-md text-ink outline-none placeholder:text-ink-subtle"
                  />
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
                <Link
                  href={hero.ctaHref}
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-gold-soft px-5 text-label-lg text-bronze-ink shadow-card transition-colors hover:bg-gold-pale active:scale-[0.98]"
                >
                  {ctaLabel} <Icon name="arrow_forward" className="text-lg" />
                </Link>
                <Link href="/shop" className="inline-flex min-h-11 items-center text-label-lg text-on-dark underline-offset-4 hover:underline">
                  Browse all gadgets
                </Link>
              </div>
            </div>

            {heroPicks.length > 0 ? (
              <div className="relative">
                <ul className="grid grid-cols-3 gap-2 md:gap-3 lg:grid-cols-2 lg:grid-rows-2">
                  {heroPicks.map((p, i) => (
                    <li key={p.slug} className={i === 0 ? "lg:row-span-2" : undefined}>
                      <Link
                        href={`/lp/${p.slug}`}
                        className="group relative block aspect-square overflow-hidden rounded-xl bg-navy lg:aspect-auto lg:h-full lg:min-h-36"
                      >
                        <Image
                          src={p.imageUrl!}
                          alt={p.imageAlt}
                          fill
                          sizes="(min-width: 1024px) 280px, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          preload={i === 0}
                          loading={i === 0 ? "eager" : undefined}
                          fetchPriority={i === 0 ? "high" : undefined}
                        />
                        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-navy-deep/90 to-transparent" aria-hidden />
                        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-card px-1.5 py-0.5 text-label-sm text-navy-deep tabular lg:bottom-2.5 lg:left-2.5 lg:text-label-md">
                          {formatNaira(p.priceKobo)}
                        </span>
                        <span className="sr-only">{p.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {settings.trustBar.length ? (
            <ul className="relative grid grid-cols-2 gap-x-4 gap-y-2 border-t border-on-dark/10 px-5 py-3 md:px-8 lg:flex lg:justify-center lg:gap-8 lg:px-10" aria-label="Why shop with MUBAZZAR">
              {settings.trustBar.map((t) => (
                <li key={t.text} className="flex items-center gap-1.5">
                  <Icon name={t.icon} className={t.tone === "gold" ? "shrink-0 text-base text-gold-pale" : "shrink-0 text-base text-emerald-mint"} />
                  <span className="text-label-sm text-on-dark">{t.text}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {/* Categories */}
      <section className="px-4 pt-6 pb-2" aria-labelledby="cats-title">
        <SectionHeader
          title={<span id="cats-title">Browse Categories</span>}
          action={
            <Link href="/shop" className="flex min-h-11 items-center gap-0.5 text-label-md text-bronze hover:underline">
              See All <Icon name="chevron_right" className="text-base" />
            </Link>
          }
        />
        <ul className="grid grid-cols-4 gap-2 md:gap-3 lg:grid-cols-8">
          {categories.map((c) => (
            <li key={c.slug} className="min-w-0">
              <Link
                href={`/c/${c.slug}`}
                className="group flex h-full flex-col items-center gap-1.5 rounded-xl border border-line bg-card px-1 py-3 text-center transition-colors hover:border-gold hover:bg-gold-soft/10"
              >
                <Icon name={c.icon} className="text-[1.75rem] text-navy transition-colors group-hover:text-bronze" />
                <span className="text-label-sm leading-tight text-ink">{c.shortName ?? c.name}</span>
              </Link>
            </li>
          ))}
          <li className="min-w-0">
            <Link
              href="/shop"
              className="group flex h-full flex-col items-center gap-1.5 rounded-xl border border-navy bg-navy px-1 py-3 text-center text-on-dark transition-colors hover:bg-navy-deep"
            >
              <Icon name="grid_view" className="text-[1.75rem] text-gold-soft" />
              <span className="text-label-sm leading-tight">All gadgets</span>
            </Link>
          </li>
        </ul>
      </section>

      {/* Flash deals — countdown to the real ends_at of the soonest active deal */}
      {deals.length > 0 ? (
        <section
          className={cx(
            "mt-6 bg-navy-deep px-4 py-6 md:mx-4 md:rounded-2xl md:px-6",
            fewDeals && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center lg:gap-10 lg:p-10",
          )}
          aria-labelledby="flash-title"
          data-testid="flash-deals"
        >
          <div className={cx("mb-4 flex flex-wrap items-end justify-between gap-3", fewDeals && "lg:mb-0 lg:flex-col lg:items-start lg:gap-4")}>
            <div>
              <h2 id="flash-title" className="flex items-center gap-1.5 font-display text-headline-md leading-tight font-bold text-on-dark md:text-headline-xl">
                <Icon name="flash_on" className="text-gold-soft" />
                {settings.flashSection.title}
              </h2>
              {settings.flashSection.subtitle ? <p className="mt-0.5 text-body-md text-on-dark-muted">{settings.flashSection.subtitle}</p> : null}
            </div>
            {dealsEnd ? <Countdown endsAt={dealsEnd} serverNow={serverNow} label="Deals end in" variant="boxes" /> : null}
            {fewDeals ? (
              <Link href="/deals" className="hidden min-h-11 items-center gap-0.5 text-label-lg text-gold-soft hover:underline lg:inline-flex">
                See every deal <Icon name="chevron_right" className="text-base" />
              </Link>
            ) : null}
          </div>
          <div className={cx("grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3", fewDeals ? "lg:grid-cols-2" : "lg:grid-cols-4")}>
            {deals.map((d) => (
              <ProductCard
                key={d.dealId}
                product={d}
                ctaLabel="Quick Order"
                ctaIcon="shopping_cart_checkout"
                imageOverlay={
                  d.promoText ? (
                    <span className="absolute right-1.5 bottom-1.5 left-1.5 truncate rounded bg-navy/85 px-1.5 py-0.5 text-center text-[0.6875rem] font-bold text-gold-pale backdrop-blur-sm">
                      {d.promoText}
                    </span>
                  ) : null
                }
              />
            ))}
          </div>
          {deals.some((d) => d.lowStockUnits) ? (
            <ul className="mt-3 flex flex-col gap-1">
              {deals
                .filter((d) => d.lowStockUnits)
                .map((d) => (
                  <li key={d.dealId} className="flex items-center gap-1 text-label-sm text-coral-soft">
                    <Icon name="warning" className="text-sm" /> Only {d.lowStockUnits} left: {d.name}
                  </li>
                ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* Viral problem solvers */}
      {curated.length > 0 ? (
        <section className="px-4 pt-8 pb-2" aria-labelledby="viral-title">
          <SectionHeader
            title={<span id="viral-title">Viral Problem Solvers</span>}
            subtitle="Hard-to-find life hacks tested for durability"
            action={
              <Link href="/c/problem-solvers" className="flex min-h-11 items-center gap-0.5 text-label-md text-bronze hover:underline">
                View All <Icon name="chevron_right" className="text-base" />
              </Link>
            }
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {curated.map((p) => (
              <ProductRow key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Reviews */}
      {reviews.length > 0 ? (
        <section className="px-4 pt-8 pb-2" aria-labelledby="reviews-title">
          <SectionHeader
            title={<span id="reviews-title">Verified Nigerian Buyers</span>}
            subtitle="What customers in Lagos, Abuja, PH and beyond say"
            action={<Stars rating={5} className="text-lg" label={false} />}
          />
          <div
            className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0"
            tabIndex={0}
            role="region"
            aria-label="Customer reviews"
          >
            {reviews.map((r, i) => (
              <ReviewCard key={r.id} review={r} index={i} showProduct className="w-64 shrink-0 lg:w-auto" />
            ))}
          </div>
        </section>
      ) : null}

    </>
  );
}
