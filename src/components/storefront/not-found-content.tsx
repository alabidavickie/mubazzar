import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { SearchBox } from "./search-box";

const POPULAR = [
  { href: "/shop", label: "Shop all gadgets", icon: "grid_view" },
  { href: "/deals", label: "Today's deals", icon: "local_fire_department" },
  { href: "/track", label: "Track my order", icon: "local_shipping" },
  { href: "/faq", label: "Help & FAQ", icon: "help" },
];

/** Branded 404 body: search, popular destinations and categories. */
export function NotFoundContent({ categories = [] }: { categories?: { slug: string; name: string; emoji: string | null }[] }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6" data-testid="not-found">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-surface-container text-navy shadow-card">
          <Icon name="search" className="text-4xl" />
        </span>
        <p className="font-display text-display font-bold text-bronze" aria-hidden>
          404
        </p>
        <h1 className="font-display text-headline-xl font-bold text-navy">We couldn&apos;t find that page</h1>
        <p className="text-body-md text-ink-muted">
          The link may be old or the product may have sold out and been retired. Try a search — we&apos;ll suggest products as you
          type.
        </p>
      </div>
      <SearchBox action="/search" label="Search MUBAZZAR" />
      <nav aria-label="Popular pages">
        <ul className="grid grid-cols-2 gap-2">
          {POPULAR.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="flex min-h-12 items-center gap-2 rounded-xl bg-card px-3 text-label-md text-navy shadow-card hover:bg-surface-container"
              >
                <Icon name={l.icon} className="text-lg text-bronze" /> {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {categories.length ? (
        <nav aria-label="Categories">
          <p className="mb-1 text-label-sm tracking-wider text-bronze uppercase">Browse categories</p>
          <ul className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/c/${c.slug}`} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-surface-high px-3.5 text-label-md text-ink">
                  {c.emoji ? <span aria-hidden>{c.emoji}</span> : null} {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <Link href="/" className="mx-auto inline-flex min-h-11 items-center gap-1 text-label-md text-navy underline-offset-2 hover:underline">
        <Icon name="arrow_back" className="text-base" /> Back to the homepage
      </Link>
    </div>
  );
}

/** Branded error body (500) with retry + WhatsApp help. */
export function ErrorContent({ onRetry, digest }: { onRetry: () => void; digest?: string }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-4 py-10 text-center" data-testid="error-page">
      <span className="flex size-16 items-center justify-center rounded-full bg-urgent-soft text-urgent shadow-card">
        <Icon name="error" className="text-4xl" />
      </span>
      <h1 className="font-display text-headline-xl font-bold text-navy">Something went wrong on our side</h1>
      <p className="text-body-md text-ink-muted">
        Sorry — this page didn&apos;t load. Your cart and any order you already placed are safe. Try again, or message us and we&apos;ll
        help you finish your order in chat.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-navy px-5 text-label-lg text-on-dark shadow-card"
        >
          <Icon name="refresh" /> Try again
        </button>
        <a
          href="/api/support/whatsapp"
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-emerald-ink px-5 text-label-lg text-on-dark shadow-card"
        >
          <Icon name="chat" /> WhatsApp help
        </a>
      </div>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard navigation recovers from a broken client state */}
      <a href="/" className="inline-flex min-h-11 items-center text-label-md text-navy underline underline-offset-2">
        Go to the homepage
      </a>
      {digest ? <p className="text-body-sm text-ink-subtle">Error reference: {digest}</p> : null}
    </div>
  );
}
