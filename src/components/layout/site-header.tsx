import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { CartLink } from "./cart-link";
import { buildWhatsAppLink } from "@/lib/chat/links";
import type { CategoryData } from "@/server/services/catalog";

/**
 * Sticky storefront header (design: Home/Catalog): navy promo strip, brand row with search,
 * same-day delivery badge, WhatsApp, cart count and account, then category quick pills.
 */
export function SiteHeader({
  promoStrip,
  categories,
  supportWhatsApp,
  pageLabel,
  signedIn,
}: {
  promoStrip: string;
  categories: CategoryData[];
  supportWhatsApp: string;
  pageLabel?: string;
  signedIn?: boolean;
}) {
  const waHref = buildWhatsAppLink(supportWhatsApp, "Hello MUBAZZAR, I need help with an order.");
  return (
    <header className="sticky top-0 z-40 bg-surface/90 shadow-[0_1px_8px_rgb(0_0_0/0.04)] backdrop-blur-xl pt-safe">
      <div className="flex items-center justify-center gap-1 overflow-hidden bg-navy-deep px-4 py-0.5 whitespace-nowrap text-gold-pale">
        <Icon name="verified_user" className="shrink-0 text-sm" />
        <p className="truncate text-label-sm tracking-tight">{promoStrip}</p>
      </div>

      <div className="mx-auto flex h-12 max-w-(--container-site) items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="font-sans text-headline-sm font-extrabold tracking-wider text-navy" aria-label="MUBAZZAR home">
            MUBAZZAR
          </Link>
          {pageLabel ? (
            <span className="hidden rounded bg-surface-container px-1.5 py-0.5 text-label-sm font-bold text-ink-muted sm:inline-block">
              {pageLabel}
            </span>
          ) : null}
        </div>
        <nav aria-label="Quick actions" className="flex items-center gap-0.5">
          <Link
            href="/delivery"
            className="mr-1 hidden items-center gap-1 rounded-full bg-emerald-soft px-2.5 py-1 text-label-sm text-emerald-ink md:flex"
          >
            <Icon name="bolt" className="text-sm" /> Same-day Lagos & Abuja
          </Link>
          <Link href="/search" aria-label="Search products" className="flex size-11 items-center justify-center text-ink hover:text-navy">
            <Icon name="search" />
          </Link>
          <a
            href={waHref}
            target="_blank"
            rel="noopener"
            aria-label="Chat with MUBAZZAR on WhatsApp"
            className="flex size-11 items-center justify-center text-emerald-ink hover:opacity-80"
          >
            <Icon name="chat" />
          </a>
          <CartLink />
          <Link
            href={signedIn ? "/account" : "/login"}
            aria-label={signedIn ? "My account" : "Sign in"}
            className="flex size-11 items-center justify-center text-navy"
          >
            <Icon name="account_circle" className="text-[1.75rem]" />
          </Link>
        </nav>
      </div>

      <nav aria-label="Categories" className="no-scrollbar flex h-10 items-center gap-2 overflow-x-auto px-4 pb-1 md:justify-center">
        <Link
          href="/deals"
          className="flex shrink-0 items-center gap-0.5 rounded-full bg-gold-soft px-3 py-1 text-label-md text-bronze-ink"
        >
          <Icon name="local_fire_department" className="text-sm" /> Hot Deals
        </Link>
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/c/${c.slug}`}
            className="shrink-0 rounded-full bg-surface-high px-3 py-1 text-label-md text-ink-muted hover:bg-surface-container"
          >
            {c.shortName ?? c.name}
          </Link>
        ))}
        <Link href="/sell" className="shrink-0 rounded-full bg-surface-container px-3 py-1 text-label-md font-bold text-bronze">
          Sell on Mubazzar
        </Link>
      </nav>
    </header>
  );
}
