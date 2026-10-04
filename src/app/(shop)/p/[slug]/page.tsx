import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Icon } from "@/components/icons/icon";
import { DiscountBadge, Price, SavingsText } from "@/components/commerce/price";
import { Stars } from "@/components/commerce/rating";
import { ReviewCard } from "@/components/commerce/review-card";
import { HubStockList } from "@/components/storefront/hub-stock-list";
import { Countdown } from "@/components/commerce/countdown";
import { ProductCard } from "@/components/commerce/product-card";
import { Badge, BADGE_STYLE_TONE } from "@/components/ui/badge";
import { Accordion, SectionHeader } from "@/components/ui/misc";
import { TrackViewContent } from "@/components/landing/track-view-content";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { PdpBuyPanel, PdpPurchaseProvider, PdpStickyBar } from "@/components/storefront/pdp-purchase";
import { getProductBySlug, getRecentReviews, getRelatedProducts } from "@/server/services/catalog";
import { getDeliveryZones, getPublicSettings } from "@/server/services/settings";
import { getProductReviewSummary } from "@/server/services/storefront";
import { formatNaira, koboToNairaInput, savingsKobo } from "@/lib/money";
import { formatCutoff } from "@/lib/time";
import { optimizedImageProps } from "@/lib/image";
import { absoluteUrl } from "@/lib/site";
import { buildWhatsAppLink } from "@/lib/chat/links";
import { DEFAULT_HUB, toIsoOrNull } from "@/lib/landing";
import { etaForState } from "@/lib/stock";
import { reviewsHeading } from "@/lib/reviews";

export const revalidate = 60;

// Rendered on first request, then cached and revalidated (ISR) — nothing on this page is per-visitor.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

type Params = Promise<{ slug: string }>;

const load = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  return getProductBySlug(slug);
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return { title: "Product not found", robots: { index: false, follow: true } };
  const title = p.seoTitle ?? p.name;
  const description =
    p.seoDescription ??
    `${p.shortDescription ?? p.name}. ${formatNaira(p.priceKobo)} — tested before dispatch, delivered across Nigeria. Order and pay in WhatsApp chat.`;
  const image = p.images[0];
  return {
    title,
    description,
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/p/${p.slug}`,
      images: image ? [{ url: image.url, alt: image.alt || p.name }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [image.url] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await load(slug);
  if (!product) notFound();

  const [reviews, summary, related, settings, zones] = await Promise.all([
    getRecentReviews({ productId: product.id, limit: 8 }),
    getProductReviewSummary(product.id),
    getRelatedProducts(product.id, product.categorySlug, 4),
    getPublicSettings(),
    getDeliveryZones(),
  ]);

  const serverNow = new Date().toISOString();
  // One real deadline per product (earliest live bundle promo / flash deal); null = no promo copy.
  const promoEndsAt = toIsoOrNull(product.promoEndsAt);
  const soldOut = product.availableUnits <= 0;
  const images = product.images.length ? product.images : product.imageUrl ? [{ url: product.imageUrl, alt: product.imageAlt }] : [];
  const slides = images.map((im, i) =>
    optimizedImageProps({
      src: im.url,
      alt: im.alt || product.name,
      fill: true,
      sizes: "(min-width: 1024px) 600px, (min-width: 640px) 80vw, 100vw",
      className: "object-cover",
      loading: i === 0 ? "eager" : "lazy",
      fetchPriority: i === 0 ? "high" : "auto",
    }),
  );
  const thumbs = images.map((im) =>
    optimizedImageProps({ src: im.url, alt: "", fill: true, sizes: "64px", className: "object-cover", loading: "lazy" }),
  );
  const saved = savingsKobo(product.priceKobo, product.compareAtKobo);
  const askHref = buildWhatsAppLink(settings.support.whatsapp, `Hello MUBAZZAR, I have a question about the ${product.name} (/p/${product.slug}).`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description ?? undefined,
    image: images.map((i) => absoluteUrl(i.url)),
    sku: product.slug,
    category: product.categoryName ?? undefined,
    brand: { "@type": "Brand", name: "MUBAZZAR" },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/p/${product.slug}`),
      priceCurrency: "NGN",
      price: koboToNairaInput(product.priceKobo),
      availability: soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      ...(promoEndsAt ? { priceValidUntil: promoEndsAt.slice(0, 10) } : {}),
      seller: { "@type": "Organization", name: settings.business.legalName },
    },
    // Structured data only ever uses REAL approved reviews — never seeded sample reviews.
    ...(summary.real.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: summary.real.average, reviewCount: summary.real.count } }
      : {}),
  };

  return (
    <PdpPurchaseProvider
      product={{
        id: product.id,
        slug: product.slug,
        name: product.name,
        imageUrl: product.imageUrl,
        priceKobo: product.priceKobo,
        compareAtKobo: product.compareAtKobo,
        giftName: product.giftName,
        availableUnits: product.availableUnits,
      }}
      bundles={product.bundles}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <TrackViewContent productId={product.id} valueKobo={product.priceKobo} />

      <nav aria-label="Breadcrumb" className="px-4 pt-2">
        <ol className="flex min-w-0 items-center gap-1 text-label-sm text-ink-muted">
          <li>
            <Link href="/" className="inline-flex min-h-11 items-center hover:text-navy">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/shop" className="inline-flex min-h-11 items-center hover:text-navy">
              Shop
            </Link>
          </li>
          {product.categorySlug ? (
            <>
              <li aria-hidden>/</li>
              <li className="min-w-0">
                <Link href={`/c/${product.categorySlug}`} className="inline-flex min-h-11 items-center truncate hover:text-navy">
                  {product.categoryName}
                </Link>
              </li>
            </>
          ) : null}
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-12 lg:gap-8">
        {/* Gallery */}
        <div className="min-w-0 lg:col-span-6">
          <div className="lg:sticky lg:top-32">
            <ProductGallery slides={slides} thumbs={thumbs} productName={product.name}>
              <DiscountBadge
                priceKobo={product.priceKobo}
                compareAtKobo={product.compareAtKobo}
                suffix=" OFF"
                className="pointer-events-none absolute top-3 left-3 rounded-full px-2.5 py-1 text-label-md"
              />
              {product.imageBadge ? (
                <Badge
                  tone={BADGE_STYLE_TONE[product.imageBadgeStyle]}
                  size="pill"
                  icon={product.imageBadgeIcon}
                  className="pointer-events-none absolute top-3 right-3"
                >
                  {product.imageBadge}
                </Badge>
              ) : null}
            </ProductGallery>
          </div>
        </div>

        {/* Info + buy */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-6">
          <div className="flex flex-col gap-1.5">
            {product.categoryName ? (
              <p className="text-label-sm tracking-wider text-bronze uppercase">{product.categoryName}</p>
            ) : null}
            <h1 className="font-display text-headline-xl font-bold text-navy-deep">{product.name}</h1>
            {product.shortDescription ? <p className="text-body-md text-ink-muted">{product.shortDescription}</p> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {summary.count > 0 ? (
                <a href="#reviews" className="flex min-h-11 items-center gap-1.5" data-testid="pdp-rating">
                  <Stars rating={summary.average} className="text-sm" />
                  <span className="text-label-md text-navy">{summary.average.toFixed(1)}</span>
                  <span className="text-body-sm text-ink-muted underline underline-offset-2">
                    {summary.count} {summary.count === 1 ? "review" : "reviews"}
                    {summary.sampleCount > 0 ? " (incl. samples)" : ""}
                  </span>
                </a>
              ) : (
                <span className="text-body-sm text-ink-muted">No reviews yet</span>
              )}
              {product.soldCount > 0 ? (
                <span className="text-body-sm text-ink-muted">{product.soldCount.toLocaleString("en-NG")} sold</span>
              ) : null}
            </div>
          </div>

          {/* Price */}
          <section aria-label="Price" className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <Price priceKobo={product.priceKobo} compareAtKobo={product.compareAtKobo} size="lg" compareClassName="text-body-md" />
              <DiscountBadge priceKobo={product.priceKobo} compareAtKobo={product.compareAtKobo} suffix=" OFF" />
            </div>
            {saved > 0 ? (
              <p className="text-body-sm text-ink-muted">
                You save <SavingsText priceKobo={product.priceKobo} compareAtKobo={product.compareAtKobo} />
              </p>
            ) : null}
            {promoEndsAt ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-navy-deep px-3 py-2 text-on-dark">
                <span className="flex items-center gap-1 text-label-sm text-gold-pale">
                  <Icon name="flash_on" className="text-sm" /> Promo price ends in
                </span>
                <Countdown endsAt={promoEndsAt} serverNow={serverNow} variant="inline" label="Promo price ends in" endedLabel="Promo ended" className="text-label-lg text-gold-soft" />
              </div>
            ) : null}
            <ul className="flex flex-col gap-1.5 pt-1 text-body-sm">
              {product.podAvailable ? (
                <li className="flex items-center gap-1.5 text-emerald-ink">
                  <Icon name="payments" className="text-base" /> Pay on Delivery available — arrange in chat
                </li>
              ) : null}
              {product.deliveryNote ? (
                <li className="flex items-center gap-1.5 text-ink">
                  <Icon name={product.deliveryNoteIcon ?? "local_shipping"} className="text-base text-navy" /> {product.deliveryNote}
                </li>
              ) : null}
              <li className="flex items-center gap-1.5 text-ink">
                <Icon name="bolt" className="text-base text-bronze" /> Same-day in Lagos &amp; Abuja when you order before{" "}
                {formatCutoff(settings.sameDayCutoff)}
              </li>
              {product.warrantyMonths > 0 ? (
                <li className="flex items-center gap-1.5 text-ink">
                  <Icon name="verified_user" className="text-base text-navy" /> {product.warrantyMonths}-month warranty
                </li>
              ) : null}
            </ul>
          </section>

          {/* Stock per hub */}
          {product.stock.length ? (
            <section aria-labelledby="stock-title" className="flex flex-col gap-2.5 rounded-xl bg-card p-4 shadow-card">
              <h2 id="stock-title" className="flex items-center gap-1 text-label-lg font-bold text-navy">
                <Icon name="inventory_2" className="text-base" /> Stock by hub
              </h2>
              <HubStockList stock={product.stock} nearestHub={DEFAULT_HUB} eta={etaForState(null, zones)} />
            </section>
          ) : null}

          {/* Free gift */}
          {product.gift ? (
            <section aria-labelledby="gift-title" className="flex items-center gap-3 rounded-xl bg-gold-soft/25 p-4 shadow-card">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-card text-bronze">
                <Icon name="redeem" className="text-3xl" />
              </span>
              <div className="min-w-0">
                <p className="text-label-sm tracking-wider text-bronze uppercase">
                  Free bonus gift{product.gift.valueKobo > 0 ? ` (worth ${formatNaira(product.gift.valueKobo)})` : ""}
                </p>
                <h2 id="gift-title" className="text-label-lg font-bold text-navy">
                  1x {product.gift.name}
                </h2>
                {product.gift.conditions ? <p className="text-body-sm text-ink-muted">{product.gift.conditions}</p> : null}
              </div>
            </section>
          ) : null}

          <PdpBuyPanel />

          <a
            href={askHref}
            target="_blank"
            rel="noopener"
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-label-md text-emerald-ink underline-offset-2 hover:underline"
          >
            <Icon name="chat" className="text-base" /> Questions? Ask us on WhatsApp
          </a>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-5 px-4 lg:mx-auto lg:max-w-4xl">
        {/* Description + features */}
        {product.description || product.features.length ? (
          <section aria-labelledby="about-title" className="flex flex-col gap-2">
            <h2 id="about-title" className="text-headline-md font-bold text-navy">
              About this product
            </h2>
            {product.description ? <p className="text-body-md leading-relaxed text-ink-muted">{product.description}</p> : null}
            {product.features.length ? (
              <ul className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-2">
                {product.features.map((f) => (
                  <li key={f.title} className="flex items-start gap-3 rounded-xl bg-card p-4 shadow-card">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-container text-navy">
                      <Icon name={f.icon} className="text-2xl" />
                    </span>
                    <span className="min-w-0">
                      <h3 className="text-label-lg font-bold text-navy">{f.title}</h3>
                      <p className="text-body-md text-ink-muted">{f.description}</p>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {/* Specs */}
        {product.specs.length ? (
          <section aria-labelledby="specs-title" className="flex flex-col gap-2">
            <h2 id="specs-title" className="text-headline-md font-bold text-navy">
              Specifications
            </h2>
            <div className="overflow-hidden rounded-xl bg-card shadow-card">
              <table className="w-full text-left text-body-md">
                <caption className="sr-only">{product.name} specifications</caption>
                <tbody>
                  {product.specs.map((s, i) => (
                    <tr key={s.label} className={i % 2 ? "bg-card" : "bg-surface-low"}>
                      <th scope="row" className="w-2/5 px-4 py-2.5 align-top text-label-md font-semibold text-navy">
                        {s.label}
                      </th>
                      <td className="px-4 py-2.5 text-ink">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* FAQ */}
        {product.faqs.length ? (
          <section aria-labelledby="faq-title" className="flex flex-col gap-2">
            <h2 id="faq-title" className="text-headline-md font-bold text-navy">
              Frequently Asked Questions
            </h2>
            <Accordion items={product.faqs} />
          </section>
        ) : null}

        {/* Reviews */}
        <section id="reviews" aria-labelledby="reviews-title" className="flex scroll-mt-32 flex-col gap-3">
          <h2 id="reviews-title" className="text-headline-md font-bold text-navy">
            {reviewsHeading(reviews, "Customer Reviews")}
          </h2>
          {summary.count > 0 ? (
            <div className="flex items-center gap-4 rounded-xl bg-card p-4 shadow-card">
              <div className="flex shrink-0 flex-col items-center">
                <span className="text-[2.5rem] leading-none font-extrabold text-navy-deep tabular">{summary.average.toFixed(1)}</span>
                <Stars rating={summary.average} className="text-sm" />
                <span className="mt-0.5 text-body-sm text-ink-muted">
                  {summary.count} {summary.count === 1 ? "review" : "reviews"}
                </span>
              </div>
              <ul className="flex min-w-0 flex-1 flex-col gap-1" aria-label="Rating breakdown">
                {summary.distribution.map((n, i) => {
                  const stars = 5 - i;
                  const pct = summary.count ? Math.round((n / summary.count) * 100) : 0;
                  return (
                    <li key={stars} className="flex items-center gap-2 text-body-sm text-ink-muted">
                      <span className="w-3 tabular">{stars}</span>
                      <span className="sr-only">stars: {n} reviews</span>
                      <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-high">
                        <span className="block h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                      </span>
                      <span aria-hidden className="w-6 text-right tabular">
                        {n}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl bg-card p-4 text-body-md text-ink-muted shadow-card">
              No reviews yet. Bought this before? Sign in to your account after delivery to leave a verified review.
            </p>
          )}
          {summary.sampleCount > 0 ? (
            <p className="text-body-sm text-ink-muted">
              Reviews marked &ldquo;Sample review&rdquo; are demo content in this preview store, not real customer feedback.
            </p>
          ) : null}
          {reviews.length ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {reviews.map((r, i) => (
                <ReviewCard key={r.id} review={r} index={i} />
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {/* Related */}
      {related.length ? (
        <section aria-labelledby="related-title" className="mt-6 bg-surface-low px-4 py-5">
          <SectionHeader title={<span id="related-title">You may also like</span>} subtitle="More tested finds from this shelf" />
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {related.map((p) => (
              <li key={p.id} className="flex min-w-0">
                <ProductCard product={p} className="w-full" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PdpStickyBar />
    </PdpPurchaseProvider>
  );
}
