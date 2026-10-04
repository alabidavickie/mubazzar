import type { Metadata } from "next";
import { preload } from "react-dom";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Icon } from "@/components/icons/icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { DiscountBadge, Price, SavingsText } from "@/components/commerce/price";
import { ReviewCard } from "@/components/commerce/review-card";
import { Stars } from "@/components/commerce/rating";
import { Accordion } from "@/components/ui/misc";
import { FloatingWhatsApp } from "@/components/layout/floating-whatsapp";
import { LandingProvider } from "@/components/landing/landing-provider";
import { LandingBundles } from "@/components/landing/landing-bundles";
import { DeferredLandingOrderForm } from "@/components/landing/deferred-order-form";
import { StaticImg, staticImgProps } from "@/components/landing/static-img";
import { LandingStock } from "@/components/landing/landing-stock";
import { LandingGallery } from "@/components/landing/gallery";
import { PromoCountdown, PromoEnded } from "@/components/landing/promo-countdown";
import { StickyOrderBar } from "@/components/landing/sticky-order-bar";
import { VideoPlayer } from "@/components/landing/video-teaser";
import { TrackViewContent } from "@/components/landing/track-view-content";
import { getLandingPage, type LandingBundle } from "@/server/services/landing";
import { getLandingPreview } from "@/server/services/landing-preview";
import { getRealRatingSummary } from "@/server/services/rating-summary";
import { getDeliveryZones, getEnabledChannels, getPublicSettings } from "@/server/services/settings";
import { buildWhatsAppLink, CHANNEL_LABEL } from "@/lib/chat/links";
import { formatNaira, koboToNairaInput, savingsKobo } from "@/lib/money";
import { formatNgPhoneIntl } from "@/lib/phone";
import { landingTimer, nearestHubFromGeo, promoPricing, youTubeEmbedUrl } from "@/lib/landing";
import { markupToPlainText, renderMarkup } from "@/lib/markup";
import { absoluteUrl } from "@/lib/site";

// Dynamic: reads the visitor's geo header (nearest hub stock) and staff preview sessions.
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ preview?: string | string[] }>;

const load = cache(async (slug: string, wantPreview: boolean): Promise<{ data: LandingBundle; preview: boolean } | null> => {
  if (wantPreview) {
    const p = await getLandingPreview(slug);
    if (p) return { data: p, preview: true };
  }
  const d = await getLandingPage(slug);
  return d ? { data: d, preview: false } : null;
});

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { slug } = await params;
  const { preview } = await searchParams;
  const res = await load(slug, preview === "1");
  if (!res) return { title: "Offer not found", robots: { index: false, follow: false } };
  const { lp, product } = res.data;
  const title = lp.seoTitle ?? `${markupToPlainText(lp.headline)} — ${product.name}`;
  const description = lp.seoDescription || markupToPlainText(lp.subheadline) || product.shortDescription || undefined;
  const image = lp.ogImageUrl ?? product.images[0]?.url ?? null;
  return {
    title: /mubazzar/i.test(title) ? { absolute: title } : title,
    description,
    alternates: { canonical: `/lp/${lp.slug}` },
    robots: res.preview || !lp.isPublished ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      url: `/lp/${lp.slug}`,
      images: image ? [{ url: image, alt: product.images[0]?.alt ?? product.name }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function LandingPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const res = await load(slug, preview === "1");
  if (!res) notFound();
  const { lp, product, reviews } = res.data;

  const [settings, zones, channels, rating, h] = await Promise.all([
    getPublicSettings(),
    getDeliveryZones(),
    getEnabledChannels(),
    getRealRatingSummary(product.id),
    headers(),
  ]);

  const serverNow = new Date().toISOString();
  const promo = promoPricing(product, product.bundles);
  // The timer follows the real promo deadline (when the price actually changes), never campaign_ends_at.
  const timer = landingTimer(product.promoEndsAt, lp.campaignEndsAt);
  const live = timer.kind === "live";
  const endsAt = timer.kind === "live" ? timer.endsAt : null;
  const geo = nearestHubFromGeo(h.get("x-vercel-ip-country"), h.get("x-vercel-ip-country-region"), zones);
  const images = product.images.slice(0, 5);
  const slides = images.map((im, i) =>
    staticImgProps({
      src: im.url,
      alt: im.alt,
      fill: true,
      sizes: "(min-width: 672px) 672px, 100vw",
      className: "object-cover",
      loading: i === 0 ? "eager" : "lazy",
      fetchPriority: i === 0 ? "high" : "auto",
    }),
  );
  const thumbs = images.map((im) =>
    staticImgProps({ src: im.url, alt: "", fill: true, sizes: "80px", className: "object-cover", loading: "lazy" }),
  );
  // The first gallery photo is the LCP element: preload it with the same srcset the <img> uses.
  if (slides[0]) {
    preload(slides[0].src, {
      as: "image",
      fetchPriority: "high",
      imageSrcSet: slides[0].srcSet,
      imageSizes: slides[0].sizes,
    });
  }
  const channelKinds = [...new Set(channels.map((c) => c.kind))].map((k) => ({ kind: k, label: CHANNEL_LABEL[k] }));
  const stateHubs = zones.map((z) => ({
    state: z.state,
    hubCode: z.hubCode,
    etaMinDays: z.etaMinDays,
    etaMaxDays: z.etaMaxDays,
  }));
  const trust = lp.sections.filter((s) => s.kind === "trust_matrix");
  const customText = lp.sections.filter((s) => s.kind === "custom_text");
  const supportHref = buildWhatsAppLink(settings.support.whatsapp, `Hello MUBAZZAR, I have a question about the ${product.name}.`);
  const embedUrl = youTubeEmbedUrl(lp.videoUrl);
  const shownReviews = reviews.slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || markupToPlainText(lp.subheadline) || undefined,
    image: images.map((i) => absoluteUrl(i.url)),
    sku: product.slug,
    brand: { "@type": "Brand", name: "MUBAZZAR" },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/lp/${lp.slug}`),
      priceCurrency: "NGN",
      price: koboToNairaInput(promo.priceKobo),
      availability: product.availableUnits > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      ...(live && endsAt ? { priceValidUntil: endsAt.slice(0, 10) } : {}),
      seller: { "@type": "Organization", name: settings.business.legalName },
    },
    // Only real (non-sample) reviews ever feed structured data.
    ...(rating.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average, reviewCount: rating.count } }
      : {}),
  };

  return (
    <LandingProvider
      bundles={product.bundles.map((b) => ({ id: b.id, label: b.label, quantity: b.quantity, priceKobo: b.priceKobo }))}
      defaultBundleId={promo.defaultBundleId}
      fallbackPriceKobo={promo.priceKobo}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <TrackViewContent productId={product.id} valueKobo={promo.priceKobo} />

      <a
        href="#order-form"
        className="sr-only z-50 rounded bg-navy px-4 py-2 text-on-dark focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to order form
      </a>

      {/* Minimal header: logo + WhatsApp only */}
      <header className="sticky top-0 z-40 bg-surface/90 shadow-[0_1px_8px_rgb(0_0_0/0.04)] backdrop-blur-xl pt-safe">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-2 px-4">
          <span className="flex min-w-0 items-center gap-2">
            <StaticImg src="/brand/emblem.webp" alt="" width={28} height={28} className="rounded-md" />
            <span className="font-display text-headline-sm font-extrabold tracking-wide whitespace-nowrap text-navy">MUBAZZAR</span>
          </span>
          <a
            href={supportHref}
            target="_blank"
            rel="noopener"
            className="flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 rounded-full bg-emerald-ink px-3 text-label-md whitespace-nowrap text-on-dark shadow-card"
          >
            <WhatsAppIcon /> Chat<span className="sr-only"> with us on WhatsApp</span>
          </a>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-2xl pb-28">
        {res.preview ? (
          <p role="status" className="bg-gold-soft px-4 py-2 text-center text-label-md text-bronze-ink">
            Preview{lp.isPublished ? "" : " — this page is NOT published yet"}. Only staff can see this view.
          </p>
        ) : null}

        {/* Hook banner */}
        <div className="flex items-center gap-2 bg-navy px-4 py-2 text-on-dark shadow-card">
          <span className="flex shrink-0 items-center gap-1 text-label-md text-gold-soft">
            <Icon name="bolt" className="text-base" />
            {lp.hookLabel}
          </span>
          {lp.hookBanner ? <p className="min-w-0 flex-1 text-label-sm leading-snug">{lp.hookBanner}</p> : null}
          <Icon name="local_shipping" className="shrink-0 text-sm text-gold-pale" />
        </div>

        {/* Official store ribbon */}
        <div className="flex items-center justify-between gap-2 bg-surface-low px-4 py-1.5 shadow-card">
          <span className="text-label-sm tracking-wider text-navy uppercase">Official MUBAZZAR Store</span>
          <span className="flex items-center gap-1 rounded-full bg-surface-highest px-2 py-0.5 text-label-sm text-ink">
            <Icon name="verified" filled className="text-xs text-emerald-ink" /> Tested before dispatch
          </span>
        </div>

        <div className="flex flex-col gap-4 px-4 pt-3">
          {/* Headline */}
          <div className="flex flex-col gap-1.5">
            {lp.trendBadge ? (
              <span className="flex items-center gap-1 self-start rounded bg-gold-soft/30 px-2 py-0.5 text-label-sm tracking-wider text-bronze uppercase">
                <Icon name="trending_up" className="text-sm" /> {lp.trendBadge}
              </span>
            ) : null}
            <h1 className="font-display text-headline-xl leading-tight font-extrabold tracking-tight text-navy-deep">
              {renderMarkup(lp.headline)}
            </h1>
            {lp.subheadline ? <p className="text-body-md leading-snug text-ink-muted">{renderMarkup(lp.subheadline)}</p> : null}
          </div>

          {/* Rating (real reviews only) + regions */}
          {rating.count > 0 || lp.regionsText ? (
            <div className="flex flex-wrap items-center gap-2">
              {rating.count > 0 ? (
                <span className="flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1" data-testid="lp-rating">
                  <Stars rating={rating.average} className="text-sm" />
                  <span className="text-label-sm text-navy">{rating.average.toFixed(1)}/5</span>
                  <span className="text-body-sm text-ink-muted">
                    ({rating.count.toLocaleString("en-NG")} {rating.count === 1 ? "review" : "reviews"})
                  </span>
                </span>
              ) : null}
              {lp.regionsText ? (
                <span className="flex items-center gap-1 rounded-full bg-surface-high px-2 py-1 text-label-sm text-navy">
                  <Icon name="location_on" className="text-xs text-emerald-ink" /> {lp.regionsText}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Gallery */}
          <LandingGallery slides={slides} thumbs={thumbs}>
            <DiscountBadge
              priceKobo={promo.priceKobo}
              compareAtKobo={promo.compareAtKobo}
              suffix=" OFF"
              className="pointer-events-none absolute top-3 left-3 rounded-full px-2.5 py-1 text-label-md"
            />
            {lp.warrantyBadge ? (
              <span className="pointer-events-none absolute top-3 right-3 flex items-center gap-1 rounded-full bg-navy/85 px-2 py-1 text-label-sm text-on-dark backdrop-blur-md">
                <Icon name="shield_with_heart" className="text-xs text-gold-soft" /> {lp.warrantyBadge}
              </span>
            ) : null}
            {lp.heroOverlayText ? (
              <span className="pointer-events-none absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2 rounded-lg bg-navy/85 px-3 py-1.5 text-on-dark backdrop-blur-md">
                <span className="flex min-w-0 items-center gap-1 text-label-sm">
                  {lp.heroOverlayIcon ? <Icon name={lp.heroOverlayIcon} className="text-sm text-emerald-mint" /> : null}
                  <span className="truncate">{lp.heroOverlayText}</span>
                </span>
                {images.length > 1 ? <span className="shrink-0 text-body-sm text-gold-pale">Swipe for more</span> : null}
              </span>
            ) : null}
          </LandingGallery>

          {/* Price module */}
          <section aria-labelledby="price-title" className="flex flex-col gap-2.5 rounded-xl bg-card p-4 shadow-raised">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="price-title" className="text-label-sm text-ink-muted uppercase">
                  {live ? "Special promo price" : "Today's price"}
                </h2>
                <Price
                  priceKobo={promo.priceKobo}
                  compareAtKobo={promo.compareAtKobo}
                  compareClassName="text-headline-sm font-semibold"
                  className="gap-x-2"
                />
              </div>
              {savingsKobo(promo.priceKobo, promo.compareAtKobo) > 0 ? (
                <p className="shrink-0 rounded-lg bg-surface-highest px-3 py-1.5 text-right">
                  <span className="block text-label-sm text-ink-muted">You Save</span>
                  <span className="text-label-lg">
                    <SavingsText priceKobo={promo.priceKobo} compareAtKobo={promo.compareAtKobo} />
                  </span>
                </p>
              ) : null}
            </div>
            <div data-testid="promo-timer" data-ends-at={endsAt ?? ""}>
              {timer.kind === "live" ? (
                <PromoCountdown endsAt={timer.endsAt} serverNow={serverNow} />
              ) : timer.kind === "ended" ? (
                <PromoEnded />
              ) : null}
            </div>
            <LandingStock
              stock={product.stock}
              stateHubs={stateHubs}
              defaultHub={geo.hubCode}
              defaultState={geo.state}
            />
          </section>

          {/* Free gift */}
          {product.gift ? (
            <section aria-labelledby="gift-title" className="flex items-center gap-3 rounded-xl bg-gold-soft/25 p-4 shadow-card">
              {product.gift.imageUrl ? (
                <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-card">
                  <StaticImg src={product.gift.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                </span>
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-card text-bronze">
                  <Icon name="redeem" className="text-3xl" />
                </span>
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-label-sm tracking-wider text-bronze uppercase">
                  <Icon name="redeem" className="text-sm" /> Free bonus gift
                  {product.gift.valueKobo > 0 ? ` (worth ${formatNaira(product.gift.valueKobo)})` : ""}
                </p>
                <h2 id="gift-title" className="text-label-lg font-bold text-navy">
                  1x {product.gift.name}
                </h2>
                {product.gift.conditions ? <p className="text-body-sm text-ink-muted">{product.gift.conditions}</p> : null}
              </div>
            </section>
          ) : null}

          <a
            href="#order-form"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3.5 text-center text-label-lg text-on-dark uppercase shadow-raised active:scale-[0.99]"
          >
            <Icon name="inventory_2" className="text-gold-soft" /> Choose your package &amp; order now
          </a>

          {/* Features */}
          {product.features.length > 0 ? (
            <section aria-labelledby="features-title" className="flex flex-col gap-2 pt-1">
              <h2 id="features-title" className="text-headline-md font-bold text-navy">
                {lp.featuresTitle ?? `Why customers love the ${product.name}`}
              </h2>
              {lp.featuresSubtitle ? <p className="text-body-md text-ink-muted">{lp.featuresSubtitle}</p> : null}
              <ul className="mt-1 grid grid-cols-1 gap-2">
                {product.features.map((f, i) => (
                  <li key={f.title} className="flex items-start gap-3 rounded-xl bg-card p-4 shadow-card">
                    <span
                      className={
                        i % 3 === 1
                          ? "flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-container text-bronze"
                          : i % 3 === 2
                            ? "flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-container text-emerald-ink"
                            : "flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-container text-navy"
                      }
                    >
                      <Icon name={f.icon} className="text-2xl" />
                    </span>
                    <span className="min-w-0">
                      <h3 className="text-label-lg font-bold text-navy">{f.title}</h3>
                      <p className="text-body-md text-ink-muted">{f.description}</p>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Video teaser — play button only when a real video exists */}
          {lp.videoUrl || lp.videoPosterUrl ? (
            <figure className="overflow-hidden rounded-xl bg-navy shadow-raised" data-testid="lp-video">
              <div className="relative aspect-video w-full">
                {lp.videoUrl ? (
                  <VideoPlayer
                    videoUrl={lp.videoUrl}
                    embedUrl={embedUrl}
                    title={lp.videoTitle ?? `${product.name} demo`}
                    poster={
                      lp.videoPosterUrl ? (
                        <StaticImg src={lp.videoPosterUrl} alt="" fill sizes="(min-width: 768px) 672px, 100vw" className="object-cover" />
                      ) : null
                    }
                  />
                ) : lp.videoPosterUrl ? (
                  <StaticImg
                    src={lp.videoPosterUrl}
                    alt={lp.videoTitle ?? `${product.name} in use`}
                    fill
                    sizes="(min-width: 768px) 672px, 100vw"
                    className="object-cover"
                  />
                ) : null}
              </div>
              {lp.videoTitle || lp.videoSubtitle ? (
                <figcaption className="flex flex-col px-4 py-2.5 text-center">
                  {lp.videoTitle ? <span className="text-label-lg font-bold text-on-dark">{lp.videoTitle}</span> : null}
                  {lp.videoSubtitle ? <span className="text-body-sm text-gold-pale">{lp.videoSubtitle}</span> : null}
                </figcaption>
              ) : null}
            </figure>
          ) : null}

          {/* Step 1: bundles */}
          {product.bundles.length > 0 ? (
            <section id="packages" aria-labelledby="packages-title" className="flex scroll-mt-16 flex-col gap-2 pt-1">
              <div>
                <p className="text-label-sm tracking-wider text-bronze uppercase">Step 1: Choose your money-saving package</p>
                <h2 id="packages-title" className="text-headline-md font-bold text-navy">
                  Exclusive Bundle Discounts
                </h2>
              </div>
              <LandingBundles bundles={product.bundles} />
            </section>
          ) : null}

          {/* Trust matrix */}
          {trust.map((s) => (
            <section
              key={s.id}
              aria-label={s.title ?? "Why it's safe to order"}
              className="flex flex-col gap-3 rounded-xl bg-surface-low p-4 shadow-card"
            >
              {s.title ? <h2 className="text-label-lg font-bold text-navy">{s.title}</h2> : null}
              <ul className="flex flex-col gap-3">
                {s.items.map((it) => (
                  <li key={it.title} className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-emerald-ink shadow-card">
                      <Icon name={it.icon} className="text-xl" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-label-md font-bold text-navy">{it.title}</span>
                      <span className="block text-body-sm text-ink-muted">{it.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {customText.map((s) => (
            <section key={s.id} aria-label={s.title ?? undefined} className="flex flex-col gap-1.5">
              {s.title ? <h2 className="text-headline-sm font-bold text-navy">{s.title}</h2> : null}
              {s.body
                ? s.body.split(/\n{2,}/).map((para, i) => (
                    <p key={i} className="text-body-md text-ink-muted">
                      {renderMarkup(para)}
                    </p>
                  ))
                : null}
            </section>
          ))}

          {/* Reviews */}
          {shownReviews.length > 0 ? (
            <section aria-labelledby="reviews-title" className="flex flex-col gap-2 pt-1">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-label-sm tracking-wider text-bronze uppercase">Honest feedback</p>
                  <h2 id="reviews-title" className="text-headline-md font-bold text-navy">
                    What Buyers Say
                  </h2>
                </div>
                {shownReviews.some((r) => r.isVerifiedPurchase) ? (
                  <span className="rounded bg-surface-container px-2 py-1 text-label-sm text-navy">Verified orders</span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                {shownReviews.map((r, i) => (
                  <ReviewCard key={r.id} review={r} index={i} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Order form */}
          <section
            id="order-form"
            aria-labelledby="order-form-title"
            className="flex scroll-mt-16 flex-col gap-3 rounded-xl bg-card p-4 shadow-float"
          >
            <div className="flex flex-col items-center text-center">
              <span className="mb-1 rounded-full bg-navy px-3 py-1 text-label-sm text-on-dark uppercase">Fast one-page order form</span>
              <h2 id="order-form-title" className="text-headline-md font-bold text-navy">
                Fill Your Delivery Information
              </h2>
              <p className="text-body-sm text-ink-muted">
                No account and no card details needed. Payment is arranged securely in chat after you order.
              </p>
            </div>
            <DeferredLandingOrderForm
              productId={product.id}
              productName={product.name}
              landingPageId={lp.id}
              zones={zones}
              channels={channelKinds}
              cutoff={settings.sameDayCutoff}
            />
          </section>

          {/* FAQ */}
          {product.faqs.length > 0 ? (
            <section aria-labelledby="faq-title" className="flex flex-col gap-2 pt-1">
              <h2 id="faq-title" className="text-headline-md font-bold text-navy">
                Frequently Asked Questions
              </h2>
              <Accordion items={product.faqs} />
            </section>
          ) : null}
        </div>

        {/* Footer trust mark */}
        <footer className="mt-6 flex flex-col items-center gap-2 border-t border-line px-4 pt-5 text-center">
          <p className="flex items-center gap-1 text-label-md text-navy">
            <Icon name="verified_user" className="text-base text-emerald-ink" /> {settings.business.legalName}
          </p>
          <p className="text-body-sm text-ink-muted">
            {settings.business.address}
            {settings.business.cac ? ` · CAC: ${settings.business.cac}` : ""}
          </p>
          <p className="text-body-sm text-ink-muted">
            Helpline:{" "}
            <a href={`tel:${settings.support.phone}`} className="font-semibold text-navy">
              {formatNgPhoneIntl(settings.support.phone)}
            </a>{" "}
            · {settings.support.hours}
          </p>
          <nav aria-label="Policies" className="flex flex-wrap justify-center gap-x-1 text-body-sm">
            {[
              ["/returns", "Returns"],
              ["/delivery", "Delivery"],
              ["/privacy", "Privacy"],
              ["/terms", "Terms"],
            ].map(([href, label]) => (
              <Link key={href} href={href!} className="inline-flex min-h-11 items-center px-2 text-ink-muted underline-offset-2 hover:underline">
                {label}
              </Link>
            ))}
          </nav>
          <p className="flex items-center gap-1 text-body-sm text-ink-muted">
            <Icon name="lock" className="text-sm" /> No card details are collected on this site. We never ask for your card PIN or OTP.
          </p>
        </footer>
      </main>

      <StickyOrderBar compareAtKobo={promo.compareAtKobo} />
      <FloatingWhatsApp number={settings.support.whatsapp} raised />
    </LandingProvider>
  );
}
