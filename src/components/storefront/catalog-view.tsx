import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { ProductCard } from "@/components/commerce/product-card";
import { EmptyState } from "@/components/ui/misc";
import { FilterChip } from "./filter-chip";
import { FilterDisclosure } from "./filter-disclosure";
import {
  catalogHref,
  hasActiveFilters,
  MAX_PAGE,
  PRICE_BAND_RANGES,
  PRICE_BANDS,
  serializeCatalogParams,
  SORT_OPTIONS,
  type CatalogState,
} from "@/lib/catalog-params";
import type { CategoryData, ProductCardData } from "@/server/services/catalog";

export interface CatalogViewProps {
  /** Base path of this listing: "/shop", "/c/<slug>" or "/search". */
  pathname: string;
  state: CatalogState;
  items: ProductCardData[];
  total: number;
  categories: CategoryData[];
  /** Count of every active product (the "All" chip). */
  allCount: number;
  /** Category pages keep the category in the path. */
  fixedCategory?: string | null;
  /** Rendered above the search bar (brand bar, page heading). */
  header: React.ReactNode;
  defaultFiltersOpen?: boolean;
  returnsDays: number;
}

function activeFilterCount(s: CatalogState): number {
  return (
    (s.price || s.min !== null || s.max !== null ? 1 : 0) + (s.pod ? 1 : 0) + (s.sameday ? 1 : 0) + (s.gift ? 1 : 0)
  );
}

/** Shop Catalog UI (design: mubazzar_shop_catalog) shared by /shop, /c/[slug] and /search. */
export function CatalogView({
  pathname,
  state,
  items,
  total,
  categories,
  allCount,
  fixedCategory,
  header,
  defaultFiltersOpen = false,
  returnsDays,
}: CatalogViewProps) {
  const href = (patch: Partial<CatalogState>) => catalogHref(pathname, state, patch);
  const shown = items.length;
  const pct = total > 0 ? Math.round((shown / total) * 100) : 0;
  const canLoadMore = shown < total && state.page < MAX_PAGE;
  const filtered = hasActiveFilters(state, { ignoreCategory: Boolean(fixedCategory) });
  const currentCategory = fixedCategory ?? state.category;

  // Keep every other filter when the search box is submitted.
  const hidden: Record<string, string> = Object.fromEntries(
    new URLSearchParams(serializeCatalogParams({ ...state, q: null, page: 1 }, { omitCategory: Boolean(fixedCategory) })),
  );
  // Custom price form keeps everything except price bounds.
  const priceHidden = Object.fromEntries(
    new URLSearchParams(
      serializeCatalogParams({ ...state, price: null, min: null, max: null, page: 1 }, { omitCategory: Boolean(fixedCategory) }),
    ),
  );
  const categoryHref = (slug: string | null) => {
    if (fixedCategory) {
      const qs = serializeCatalogParams({ ...state, category: null, page: 1 });
      const base = slug ? `/c/${slug}` : "/shop";
      return qs ? `${base}?${qs}` : base;
    }
    return href({ category: slug });
  };
  const visibleCategories = categories.filter((c) => c.productCount > 0);

  return (
    <div className="flex flex-col">
      {header}

      <div className="px-4 py-1.5">
        <FilterDisclosure
          action={pathname}
          q={state.q ?? ""}
          hidden={hidden}
          activeCount={activeFilterCount(state)}
          defaultOpen={defaultFiltersOpen || activeFilterCount(state) > 0}
        >
          <RefinementPanel state={state} href={href} pathname={pathname} priceHidden={priceHidden} />
        </FilterDisclosure>
      </div>

      {/* Category carousel */}
      <nav aria-label="Filter by category" className="no-scrollbar flex items-center gap-2 overflow-x-auto px-4 py-0.5">
        <FilterChip href={categoryHref(null)} active={!currentCategory} kind="category">
          All
          <span className="rounded-full bg-bronze px-1.5 text-[0.625rem] leading-4 font-bold text-on-dark">{allCount}</span>
        </FilterChip>
        {visibleCategories.map((c) => (
          <FilterChip key={c.slug} href={categoryHref(c.slug)} active={currentCategory === c.slug} kind="category">
            {c.emoji ? <span aria-hidden>{c.emoji}</span> : null}
            {c.shortName ?? c.name}
          </FilterChip>
        ))}
        <FilterChip href={href({ gift: !state.gift })} active={state.gift} kind="gift" testId="gift-chip">
          <span aria-hidden>🎁</span> Free Gift
          {state.gift ? <Icon name="close" className="text-sm" /> : null}
        </FilterChip>
      </nav>

      {/* Trust micro-banner */}
      <div className="px-4 py-1.5">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-container px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <Icon name="verified_user" className="shrink-0 text-lg text-bronze" />
            <span className="text-label-sm text-navy-deep">Verified Direct Sourcing • Tested Before Dispatch</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-emerald-ink">
            <span aria-hidden className="size-2 animate-pulse-soft rounded-full bg-emerald" />
            <span className="text-label-sm font-extrabold uppercase">POD in chat</span>
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-1.5">
        {state.q ? (
          <p className="mb-2 text-body-sm text-ink-muted" role="status">
            {total} {total === 1 ? "result" : "results"} for <strong className="text-ink">&ldquo;{state.q}&rdquo;</strong>
          </p>
        ) : null}
        {items.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4" data-testid="catalog-grid">
            {items.map((p, i) => (
              <li key={p.id} className="flex min-w-0">
                <ProductCard product={p} priority={i < 2} className="w-full" />
              </li>
            ))}
          </ul>
        ) : (
          <div data-testid="catalog-empty">
            <EmptyState
              icon="search"
              title={filtered ? "No gadgets match these filters" : "Nothing here yet"}
              body={
                filtered
                  ? "Try a wider price range or remove a filter. New uncommon finds land every week."
                  : "We're restocking this shelf. Check back soon or chat with us on WhatsApp — we may have it in a hub."
              }
              action={
                <Link
                  href={fixedCategory ? pathname : "/shop"}
                  scroll={false}
                  className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-navy px-5 text-label-md text-on-dark shadow-card"
                >
                  <Icon name="restart_alt" className="text-base" /> Reset all filters
                </Link>
              }
            />
          </div>
        )}
      </div>

      {/* Live count + Load More */}
      {total > 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-3 text-center">
          <div className="flex w-full max-w-xs flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-label-sm text-ink-muted" data-testid="catalog-count">
                Showing {shown} of {total} verified {total === 1 ? "product" : "products"}
              </span>
              <span className="text-label-sm font-bold text-bronze">{pct}% viewed</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-surface-high"
              role="progressbar"
              aria-label="Products viewed"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={shown}
            >
              <div className="h-full rounded-full bg-gold-soft" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {canLoadMore ? (
            <Link
              href={href({ page: state.page + 1 })}
              scroll={false}
              data-testid="load-more"
              className="flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-card text-label-lg text-navy-deep shadow-card transition-colors hover:bg-surface-container"
            >
              <Icon name="autorenew" className="text-bronze" />
              Load More Uncommon Gadgets
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* Quality promise */}
      <div className="px-4 pt-1 pb-5">
        <div className="flex items-start gap-3 rounded-xl bg-surface-low p-3 shadow-card">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-bronze-ink">
            <Icon name="verified_user" className="text-xl" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-headline-sm font-bold text-navy-deep">Quality &amp; Testing Promise</h2>
            <p className="pt-0.5 text-body-sm leading-snug text-ink-muted">
              Every item is unboxed, checked and tested before dispatch. Arrived faulty? Tell us within {returnsDays} days and
              we swap it or refund you. Pay on Delivery can be arranged in chat.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
              <Link href="/delivery" className="flex min-h-11 items-center gap-1 text-label-sm text-emerald-ink">
                <Icon name="local_shipping" className="text-sm" /> Fast State Dispatch
              </Link>
              <Link href="/returns" className="flex min-h-11 items-center gap-1 text-label-sm text-navy">
                <Icon name="currency_exchange" className="text-sm" /> {returnsDays}-Day Swap Guarantee
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RefinementPanel({
  state,
  href,
  pathname,
  priceHidden,
}: {
  state: CatalogState;
  href: (patch: Partial<CatalogState>) => string;
  pathname: string;
  priceHidden: Record<string, string>;
}) {
  const custom = state.min !== null || state.max !== null;
  return (
    <>
      {/* Price range */}
      <div className="flex flex-col gap-0.5">
        <span className="text-label-sm text-ink-muted" id="price-range-label">
          Price Range
        </span>
        <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1" role="group" aria-labelledby="price-range-label">
          <FilterChip href={href({ price: null })} active={!state.price && !custom}>
            All Prices
          </FilterChip>
          {PRICE_BANDS.map((b) => (
            <FilterChip key={b} href={href({ price: b })} active={state.price === b && !custom} testId={`price-${b}`}>
              {PRICE_BAND_RANGES[b].label}
            </FilterChip>
          ))}
        </div>
        <details className="group" open={custom}>
          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 text-label-sm font-bold text-bronze">
            <Icon name="tune" className="text-sm" />
            {custom ? `Custom: ${state.min !== null ? `₦${state.min.toLocaleString("en-NG")}` : "₦0"} – ${state.max !== null ? `₦${state.max.toLocaleString("en-NG")}` : "any"}` : "Custom price range"}
            <Icon name="expand_more" className="text-base transition-transform group-open:rotate-180" />
          </summary>
          <form action={pathname} className="flex items-center gap-2 pb-1" aria-label="Custom price range">
            {Object.entries(priceHidden).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <PriceInput name="min" label="Minimum price in naira" placeholder="Min" value={state.min} />
            <span aria-hidden className="text-ink-muted">
              –
            </span>
            <PriceInput name="max" label="Maximum price in naira" placeholder="Max" value={state.max} />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-lg bg-navy px-4 text-label-md font-bold text-on-dark shadow-card active:scale-95"
            >
              Apply
            </button>
          </form>
        </details>
      </div>

      {/* Delivery & payment refinements */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <ToggleCard
          href={href({ pod: !state.pod })}
          active={state.pod}
          icon="payments"
          iconClass="text-emerald-ink"
          title="Pay on Delivery"
          subtitle="Arrange in chat"
          testId="toggle-pod"
        />
        <ToggleCard
          href={href({ sameday: !state.sameday })}
          active={state.sameday}
          icon="bolt"
          iconClass="text-bronze"
          title="Same-Day Hub"
          subtitle="Lagos & Abuja"
          testId="toggle-sameday"
        />
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 pt-0.5">
        <span className="shrink-0 text-label-sm text-ink-muted" id="sort-label">
          Sort by:
        </span>
        <div className="no-scrollbar -mr-3 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pr-3" role="group" aria-labelledby="sort-label">
          {SORT_OPTIONS.map((o) => (
            <FilterChip key={o.key} href={href({ sort: o.key })} active={state.sort === o.key} kind="sort" testId={`sort-${o.key}`}>
              {o.label}
            </FilterChip>
          ))}
        </div>
      </div>
    </>
  );
}

function PriceInput({ name, label, placeholder, value }: { name: string; label: string; placeholder: string; value: number | null }) {
  return (
    <label className="relative min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-label-md text-ink-muted">
        ₦
      </span>
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        step={500}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-line bg-card pr-2 pl-7 text-body-md text-ink outline-none focus:border-navy"
      />
    </label>
  );
}

function ToggleCard({
  href,
  active,
  icon,
  iconClass,
  title,
  subtitle,
  testId,
}: {
  href: string;
  active: boolean;
  icon: string;
  iconClass: string;
  title: string;
  subtitle: string;
  testId: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      data-testid={testId}
      data-active={active ? "true" : "false"}
      className={
        active
          ? "flex min-h-12 items-center gap-2 rounded-lg bg-card p-2 shadow-card ring-2 ring-navy"
          : "flex min-h-12 items-center gap-2 rounded-lg bg-card p-2 shadow-card hover:bg-surface-container"
      }
    >
      <Icon name={icon} className={`shrink-0 text-base ${iconClass}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label-sm text-ink">{title}</span>
        <span className="block truncate text-body-sm text-ink-muted">{subtitle}</span>
      </span>
      <Icon name={active ? "check_circle" : "radio_button_unchecked"} filled={active} className={active ? "text-lg text-navy" : "text-lg text-line-strong"} />
      <span className="sr-only">{active ? "(on — tap to remove)" : "(off)"}</span>
    </Link>
  );
}
