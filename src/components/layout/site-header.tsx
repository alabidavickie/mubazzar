import Image from "next/image";
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
        {/* Phones show the first message only instead of cutting the whole line off mid-word. */}
        <p className="truncate text-label-sm sm:hidden">{promoStrip.split("|")[0]!.trim()}</p>
        <p className="hidden truncate text-label-sm sm:block">{promoStrip}</p>
      </div>

      <div className="mx-auto flex h-14 max-w-(--container-site) items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="flex min-h-11 items-center gap-2 font-display text-label-lg font-extrabold whitespace-nowrap text-navy-deep sm:text-headline-sm sm:tracking-wide" aria-label="MUBAZZAR home">
            <Image src="/brand/emblem.webp" alt="" width={30} height={30} className="rounded-md" loading="eager" />
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
            className="hidden size-11 items-center justify-center text-emerald-ink hover:opacity-80 sm:flex"
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

      <nav aria-label="Categories" className="no-scrollbar flex h-11 items-center gap-0.5 overflow-x-auto border-t border-line-soft px-4 lg:justify-center">
        <Link href="/deals" className="group flex min-h-11 shrink-0 items-center">
          <span className="flex items-center gap-1 rounded-full bg-gold-soft px-3 py-1.5 text-label-md text-bronze-ink group-hover:bg-gold-pale">
            <Icon name="local_fire_department" className="text-sm" /> Hot Deals
          </span>
        </Link>
        {categories.map((c) => (
          <Link key={c.slug} href={`/c/${c.slug}`} className="group flex min-h-11 shrink-0 items-center">
            <span className="rounded-full px-3 py-1.5 text-label-md text-ink-muted transition-colors group-hover:bg-surface-container group-hover:text-navy-deep">
              {c.shortName ?? c.name}
            </span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
