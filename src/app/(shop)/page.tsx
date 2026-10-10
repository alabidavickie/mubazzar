import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Countdown } from "@/components/commerce/countdown";
import { ProductCard, ProductRow } from "@/components/commerce/product-card";
import { ReviewCard } from "@/components/commerce/review-card";
import { StandardSection } from "@/components/commerce/standard-section";
import { SectionHeader } from "@/components/ui/misc";
import { Stars } from "@/components/commerce/rating";
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

  return (
    <>
      <h1 className="sr-only">MUBAZZAR — uncommon gadgets and viral problem solvers delivered across Nigeria</h1>

      {/* Search */}
      <form action="/search" role="search" className="px-4 pt-3 pb-2">
        <label htmlFor="home-search" className="sr-only">
          Search products
        </label>
        <div className="relative flex items-center rounded-xl bg-surface-container shadow-card">
          <Icon name="search" className="ml-3 text-xl text-ink-subtle" />
          <input
            id="home-search"
            name="q"
            type="search"
            enterKeyHint="search"
            placeholder="Search uncommon gadgets, kitchen hacks, car accessories…"
            className="w-full bg-transparent py-3 pr-12 pl-2 text-body-md text-ink outline-none placeholder:text-ink-subtle"
          />
          <Link href="/shop" aria-label="Open filters" className="absolute right-1 flex size-11 items-center justify-center text-navy">
            <Icon name="tune" />
          </Link>
        </div>
      </form>

      {/* Trust proof bar */}
      {settings.trustBar.length ? (
        <div className="no-scrollbar overflow-x-auto bg-navy px-4 py-2 text-on-dark" tabIndex={0} role="region" aria-label="Why shop with MUBAZZAR">
          <ul className="flex items-center gap-5 whitespace-nowrap md:justify-center">
            {settings.trustBar.map((t) => (
              <li key={t.text} className="flex items-center gap-1">
                <Icon name={t.icon} className={t.tone === "gold" ? "text-sm text-gold-pale" : "text-sm text-emerald-mint"} />
                <span className="text-label-sm tracking-tight">{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Hero */}
      <section className="px-4 py-3" aria-labelledby="hero-title">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-navy-deep via-navy to-navy-deep p-5 text-on-dark shadow-raised">
          <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-10 size-44 rounded-full bg-gold-soft/10 blur-2xl" />
          <div className="relative z-10 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-0.5 rounded-full bg-gold-soft px-2 py-0.5 text-label-sm font-extrabold tracking-wider text-bronze-ink uppercase">
                <Icon name="bolt" className="text-xs" /> {hero.badge}
              </span>
              {hero.badgeNote ? <span className="text-xs font-bold text-gold-pale">{hero.badgeNote}</span> : null}
            </div>
            <h2 id="hero-title" className="mt-1 font-display text-headline-xl leading-tight text-on-dark">
              {before}
              {highlight && after !== undefined ? <span className="text-gold-pale">{highlight}</span> : null}
              {after}
            </h2>
            {hero.subtext ? <p className="text-body-sm leading-snug text-surface-high">{hero.subtext}</p> : null}
            <div className="mt-2">
              <Link
                href={hero.ctaHref}
                className="inline-flex min-h-12 items-center gap-1 rounded-lg bg-gold-soft px-5 py-3 text-label-lg text-bronze-ink shadow-card transition active:scale-95"
              >
                {hero.ctaLabel} <Icon name="arrow_forward" className="text-lg" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-1" aria-labelledby="cats-title">
        <SectionHeader
          className="px-4"
          title={<span id="cats-title">Browse Categories</span>}
          action={
            <Link href="/shop" className="flex min-h-11 items-center text-label-md font-bold text-bronze">
              See All <Icon name="chevron_right" className="text-base" />
            </Link>
          }
        />
        <ul className="no-scrollbar flex items-start gap-3 overflow-x-auto px-4 pb-1">
          {categories.map((c) => (
            <li key={c.slug} className="shrink-0">
              <Link href={`/c/${c.slug}`} className="group flex w-[4.5rem] flex-col items-center gap-1">
                <span className="flex size-16 items-center justify-center rounded-full bg-surface-high text-navy shadow-card transition-colors group-hover:bg-gold-soft">
                  <Icon name={c.icon} className="text-2xl" />
                </span>
                <span className="text-center text-label-sm text-ink">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Flash deals — countdown to the real ends_at of the soonest active deal */}
      {deals.length > 0 ? (
        <section className="my-3 bg-surface-low px-4 py-5" aria-labelledby="flash-title" data-testid="flash-deals">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-gold-soft text-bronze-ink">
                <Icon name="flash_on" className="text-lg" />
              </span>
              <div>
                <h2 id="flash-title" className="text-headline-sm font-bold text-navy">
                  {settings.flashSection.title}
                </h2>
                {settings.flashSection.subtitle ? <p className="text-label-sm text-ink-muted">{settings.flashSection.subtitle}</p> : null}
              </div>
            </div>
            {dealsEnd ? <Countdown endsAt={dealsEnd} serverNow={serverNow} label="Deals end in" /> : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {deals.map((d, i) => (
              <ProductCard
                key={d.dealId}
                product={d}
                priority={i < 2}
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
      ) : null}

      {/* Viral problem solvers */}
      {curated.length > 0 ? (
        <section className="px-4 py-2" aria-labelledby="viral-title">
          <SectionHeader
            title={<span id="viral-title">Viral Problem Solvers</span>}
            eyebrow={<span className="rounded bg-surface-high px-1.5 py-0.5 text-label-sm font-extrabold text-navy uppercase">Curated</span>}
            subtitle="Hard-to-find life hacks tested for durability"
            action={
              <Link href="/c/problem-solvers" className="flex min-h-11 items-center text-label-md font-bold text-bronze">
                View All
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
        <section className="mt-3 bg-surface-high px-4 py-5" aria-labelledby="reviews-title">
          <SectionHeader
            title={<span id="reviews-title">Verified Nigerian Buyers</span>}
            subtitle="What customers in Lagos, Abuja, PH and beyond say"
            action={<Stars rating={5} className="text-lg" label={false} />}
          />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1" tabIndex={0} role="region" aria-label="Customer reviews">
            {reviews.map((r, i) => (
              <ReviewCard key={r.id} review={r} index={i} showProduct className="w-64 shrink-0" />
            ))}
          </div>
        </section>
      ) : null}

      <StandardSection />
    </>
  );
}
