import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";
import { Badge, BADGE_STYLE_TONE } from "@/components/ui/badge";
import { DiscountBadge, Price } from "./price";
import { RatingInline } from "./rating";
import { QuickOrderButton } from "./quick-order-button";
import { AddToCartButton } from "./add-to-cart-button";
import type { ProductCardData } from "@/server/services/catalog";

/** Catalog grid card (design: Shop Catalog). Server component with tiny client islands. */
export function ProductCard({
  product,
  priority = false,
  ctaLabel = "Order Now",
  ctaIcon = "flash_on",
  imageOverlay,
  className,
}: {
  product: ProductCardData;
  priority?: boolean;
  ctaLabel?: string;
  ctaIcon?: string;
  imageOverlay?: React.ReactNode;
  className?: string;
}) {
  const href = `/p/${product.slug}`;
  const perk = product.perkText ?? (product.giftName ? `Free ${product.giftName}` : null);
  const perkIcon = product.perkIcon ?? (product.giftName ? "redeem" : "verified");
  const soldOut = product.availableUnits <= 0;

  return (
    <article
      className={cn("flex flex-col justify-between rounded-xl bg-card p-1 shadow-card", className)}
      data-testid="product-card"
      data-slug={product.slug}
    >
      <div>
        <Link href={href} className="relative mb-1 block aspect-square overflow-hidden rounded-lg bg-surface-high">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt}
              fill
              sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
              className="object-cover"
              priority={priority}
            />
          ) : null}
          <DiscountBadge
            priceKobo={product.priceKobo}
            compareAtKobo={product.compareAtKobo}
            className="absolute top-1.5 left-1.5"
          />
          {product.imageBadge ? (
            <Badge
              tone={BADGE_STYLE_TONE[product.imageBadgeStyle]}
              size="sm"
              icon={product.imageBadgeIcon}
              className="absolute right-1.5 bottom-1.5 left-1.5 justify-center truncate"
            >
              {product.imageBadge}
            </Badge>
          ) : null}
          {imageOverlay}
          {soldOut ? (
            <span className="absolute inset-0 flex items-center justify-center bg-navy-deep/55 text-label-md font-bold text-on-dark">
              Restocking soon
            </span>
          ) : null}
        </Link>
        <div className="flex flex-col gap-1 px-1">
          <RatingInline rating={product.ratingAvg} count={product.reviewCount} soldCount={product.soldCount} />
          <h3 className="line-clamp-2 min-h-[2.25rem] text-label-md leading-tight font-bold text-ink">
            <Link href={href} className="hover:underline">
              {product.name}
            </Link>
          </h3>
          {perk ? (
            <span
              className={cn(
                "my-0.5 flex w-fit max-w-full items-center gap-1 rounded px-1.5 py-0.5",
                product.perkStyle === "neutral" ? "bg-surface-container text-ink" : "bg-gold-soft/40 text-bronze",
              )}
            >
              <Icon name={perkIcon} className="text-[0.8rem]" />
              <span className="truncate text-label-sm">{perk}</span>
            </span>
          ) : null}
          <Price priceKobo={product.priceKobo} compareAtKobo={product.compareAtKobo} className="pt-0.5" />
        </div>
      </div>
      <div className="pt-1.5">
        <QuickOrderButton productId={product.id} productName={product.name} label={ctaLabel} icon={ctaIcon} disabled={soldOut} />
      </div>
    </article>
  );
}

/** Horizontal card used by "Viral Problem Solvers" (design: Home). */
export function ProductRow({ product }: { product: ProductCardData }) {
  const href = `/p/${product.slug}`;
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-xl bg-card p-3 shadow-card" data-testid="product-row">
      <Link href={href} className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-surface-high">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.imageAlt} fill sizes="96px" className="object-cover" />
        ) : null}
        {product.curatedLabel ? (
          <span className="absolute top-1 left-1 rounded bg-gold-soft px-1 text-[0.625rem] font-extrabold text-bronze-ink">
            {product.curatedLabel}
          </span>
        ) : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="truncate text-label-lg font-bold text-navy">
          <Link href={href} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        {product.shortDescription ? <p className="truncate text-body-sm text-ink-muted">{product.shortDescription}</p> : null}
        <Price priceKobo={product.priceKobo} compareAtKobo={product.compareAtKobo} size="sm" className="mt-1" />
        <div className="mt-1 flex items-center justify-between gap-2">
          {product.deliveryNote ? (
            <span className="flex min-w-0 items-center gap-0.5 text-label-sm text-emerald-ink">
              <Icon name={product.deliveryNoteIcon ?? "local_shipping"} className="text-sm" />
              <span className="truncate">{product.deliveryNote}</span>
            </span>
          ) : (
            <span />
          )}
          <AddToCartButton
            line={{
              productId: product.id,
              bundleId: null,
              slug: product.slug,
              name: product.name,
              imageUrl: product.imageUrl,
              bundleLabel: null,
              unitPriceKobo: product.priceKobo,
              compareAtKobo: product.compareAtKobo,
              giftName: product.giftName,
            }}
            size="compact"
          />
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-1 shadow-card" aria-hidden>
      <div className="aspect-square animate-pulse rounded-lg bg-surface-high" />
      <div className="mx-1 h-3 w-1/2 animate-pulse rounded bg-surface-high" />
      <div className="mx-1 h-4 w-5/6 animate-pulse rounded bg-surface-high" />
      <div className="mx-1 h-6 w-2/3 animate-pulse rounded bg-surface-high" />
      <div className="h-10 animate-pulse rounded-lg bg-surface-high" />
    </div>
  );
}
