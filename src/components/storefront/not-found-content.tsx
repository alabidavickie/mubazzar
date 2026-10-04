import Link from "next/link";
import { Icon } from "@/components/icons/icon";

const POPULAR = [
  { href: "/shop", label: "Shop all gadgets", icon: "grid_view" },
  { href: "/deals", label: "Today's deals", icon: "local_fire_department" },
  { href: "/track", label: "Track my order", icon: "local_shipping" },
  { href: "/faq", label: "Help & FAQ", icon: "help" },
];

/**
 * Plain GET search form (no client JS) for the root 404. The root not-found boundary's client
 * components ship with EVERY route, including the ad landing page, so it must not use SearchBox.
 */
export function PlainSearchForm({ label = "Search MUBAZZAR" }: { label?: string }) {
  return (
    <form action="/search" role="search" className="relative w-full">
      <label htmlFor="not-found-search" className="sr-only">
        {label}
      </label>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xl text-ink-muted" />
      <input
        id="not-found-search"
        name="q"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder="Search gadgets, problem solvers, kitchen tech…"
        className="h-12 w-full rounded-xl bg-card pr-4 pl-10 text-body-md text-ink shadow-card outline-none transition-shadow placeholder:text-ink-subtle focus:shadow-raised focus-visible:ring-2 focus-visible:ring-gold"
      />
    </form>
  );
}

/**
 * Branded 404 body: search, popular destinations and categories. `search` is a slot so the root
 * 404 can pass `PlainSearchForm` without importing the client-side SearchBox.
 */
export function NotFoundContent({
  search,
  suggestsAsYouType = false,
  categories = [],
}: {
  search: React.ReactNode;
  suggestsAsYouType?: boolean;
  categories?: { slug: string; name: string; emoji: string | null }[];
}) {
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
          The link may be old or the product may have sold out and been retired.{" "}
          {suggestsAsYouType ? <>Try a search — we&apos;ll suggest products as you type.</> : <>Try a search or pick a page below.</>}
        </p>
      </div>
      {search}
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
