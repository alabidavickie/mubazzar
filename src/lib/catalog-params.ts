/**
 * Catalog URL state (shop, category, search and deals pages). Every filter lives in the query
 * string so a filtered view is shareable and the Back button restores it. Pure + isomorphic.
 *
 * q · category · price=under15|15-30|30-60 · min · max (whole naira) · pod=1 · sameday=1 · gift=1 ·
 * sort=popular|discount|newest|price_asc|price_desc · page (Load More: page N shows items 1..N*12)
 */

export const PAGE_SIZE = 12;
export const MAX_PAGE = 20;

export const SORT_KEYS = ["popular", "discount", "newest", "price_asc", "price_desc"] as const;
export type CatalogSort = (typeof SORT_KEYS)[number];

export const SORT_OPTIONS: { key: CatalogSort; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "discount", label: "Discount %" },
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: Low → High" },
  { key: "price_desc", label: "Price: High → Low" },
];

export const PRICE_BANDS = ["under15", "15-30", "30-60"] as const;
export type PriceBand = (typeof PRICE_BANDS)[number];

/** Band bounds in kobo (inclusive). "Under ₦15k" means strictly below ₦15,000. */
export const PRICE_BAND_RANGES: Record<PriceBand, { label: string; minKobo: number | null; maxKobo: number | null }> = {
  under15: { label: "Under ₦15k", minKobo: null, maxKobo: 1_499_999 },
  "15-30": { label: "₦15k – ₦30k", minKobo: 1_500_000, maxKobo: 2_999_999 },
  "30-60": { label: "₦30k – ₦60k", minKobo: 3_000_000, maxKobo: 6_000_000 },
};

export interface CatalogState {
  q: string | null;
  category: string | null;
  price: PriceBand | null;
  /** Custom bounds in whole naira (URL-friendly); converted to kobo for queries. */
  min: number | null;
  max: number | null;
  pod: boolean;
  sameday: boolean;
  gift: boolean;
  sort: CatalogSort;
  page: number;
}

export const DEFAULT_STATE: CatalogState = {
  q: null,
  category: null,
  price: null,
  min: null,
  max: null,
  pod: false,
  sameday: false,
  gift: false,
  sort: "popular",
  page: 1,
};

export type RawSearchParams = Record<string, string | string[] | undefined> | URLSearchParams;

function first(sp: RawSearchParams, key: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

const MAX_NAIRA = 100_000_000; // ₦100m — anything above is nonsense input

function parseNaira(v: string | undefined): number | null {
  if (!v) return null;
  const cleaned = v.replace(/[₦,\s]/g, "");
  if (!/^\d{1,9}$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n >= 0 && n <= MAX_NAIRA ? n : null;
}

const flag = (v: string | undefined) => v === "1" || v === "true" || v === "on";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Parses untrusted query params into a valid state (invalid values fall back to defaults). */
export function parseCatalogParams(sp: RawSearchParams): CatalogState {
  const qRaw = first(sp, "q")?.trim().replace(/\s+/g, " ").slice(0, 80);
  const category = first(sp, "category")?.trim().toLowerCase();
  const price = first(sp, "price");
  const sort = first(sp, "sort");
  let min = parseNaira(first(sp, "min"));
  let max = parseNaira(first(sp, "max"));
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const pageNum = Number(first(sp, "page"));
  return {
    q: qRaw ? qRaw : null,
    category: category && SLUG_RE.test(category) && category.length <= 80 ? category : null,
    price: (PRICE_BANDS as readonly string[]).includes(price ?? "") ? (price as PriceBand) : null,
    min,
    max,
    pod: flag(first(sp, "pod")),
    sameday: flag(first(sp, "sameday")),
    gift: flag(first(sp, "gift")),
    sort: (SORT_KEYS as readonly string[]).includes(sort ?? "") ? (sort as CatalogSort) : "popular",
    page: Number.isInteger(pageNum) && pageNum >= 1 ? Math.min(pageNum, MAX_PAGE) : 1,
  };
}

/** Serialises state to a canonical, stable query string (defaults omitted). No leading "?". */
export function serializeCatalogParams(state: Partial<CatalogState>, opts: { omitCategory?: boolean } = {}): string {
  const s = { ...DEFAULT_STATE, ...state };
  const out = new URLSearchParams();
  if (s.q) out.set("q", s.q);
  if (s.category && !opts.omitCategory) out.set("category", s.category);
  if (s.min !== null || s.max !== null) {
    if (s.min !== null) out.set("min", String(s.min));
    if (s.max !== null) out.set("max", String(s.max));
  } else if (s.price) {
    out.set("price", s.price);
  }
  if (s.pod) out.set("pod", "1");
  if (s.sameday) out.set("sameday", "1");
  if (s.gift) out.set("gift", "1");
  if (s.sort !== "popular") out.set("sort", s.sort);
  if (s.page > 1) out.set("page", String(s.page));
  return out.toString();
}

/**
 * Builds a link from the current state plus a patch. Any filter change resets pagination to page 1
 * unless the patch sets `page`. Choosing a price band clears custom bounds and vice versa.
 * `pathname` "/c/<slug>" keeps the category in the path instead of the query.
 */
export function catalogHref(pathname: string, state: CatalogState, patch: Partial<CatalogState> = {}): string {
  const next: CatalogState = { ...state, page: 1, ...patch };
  if ("price" in patch) {
    next.min = null;
    next.max = null;
  }
  if ("min" in patch || "max" in patch) next.price = null;
  const omitCategory = pathname.startsWith("/c/");
  const qs = serializeCatalogParams(next, { omitCategory });
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Effective price bounds in kobo for the query (custom bounds win over a band). */
export function priceBoundsKobo(state: CatalogState): { minKobo: number | null; maxKobo: number | null } {
  if (state.min !== null || state.max !== null) {
    return {
      minKobo: state.min !== null ? state.min * 100 : null,
      maxKobo: state.max !== null ? state.max * 100 : null,
    };
  }
  if (state.price) {
    const b = PRICE_BAND_RANGES[state.price];
    return { minKobo: b.minKobo, maxKobo: b.maxKobo };
  }
  return { minKobo: null, maxKobo: null };
}

/** True when any narrowing filter (not sort/page) is applied. */
export function hasActiveFilters(state: CatalogState, opts: { ignoreCategory?: boolean } = {}): boolean {
  return Boolean(
    state.q ||
      (!opts.ignoreCategory && state.category) ||
      state.price ||
      state.min !== null ||
      state.max !== null ||
      state.pod ||
      state.sameday ||
      state.gift,
  );
}

/** Number of items the server renders for the current page (Load More is cumulative). */
export function visibleLimit(state: CatalogState): number {
  return state.page * PAGE_SIZE;
}
