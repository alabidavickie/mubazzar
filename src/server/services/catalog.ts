import "server-only";
import { cache } from "react";
import { asAnon } from "../db";
import type { Queryable } from "../db";

/** Read models for the storefront. All queries run as `anon` so RLS decides what is public. */

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  priceKobo: number;
  compareAtKobo: number | null;
  ratingAvg: number;
  reviewCount: number;
  soldCount: number;
  imageUrl: string | null;
  imageAlt: string;
  imageBadge: string | null;
  imageBadgeStyle: "navy" | "emerald" | "gold" | "bronze" | "red";
  imageBadgeIcon: string | null;
  perkText: string | null;
  perkIcon: string | null;
  perkStyle: "gold" | "neutral";
  deliveryNote: string | null;
  deliveryNoteIcon: string | null;
  podAvailable: boolean;
  giftName: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  curatedLabel: string | null;
  /** Sum of available units across active hubs (what the product can actually ship). */
  availableUnits: number;
  /** "Only N left" shows only when availableUnits is at/below this (lowest hub threshold). */
  lowStockThreshold: number;
  createdAt: string;
  defaultBundleId: string | null;
}

/**
 * Price honesty (BRIEF §0.8): `priceKobo` is what the customer is charged right now (live flash-deal
 * price, else the regular price). While a promo is live the struck "was" price is the REGULAR price, so
 * "You save" = regular − promo. Without a live promo the struck price is the admin's compare-at (if any).
 */
const EFFECTIVE = `public.effective_unit_price(p.id)`;
const DISPLAY_COMPARE = `(case when ${EFFECTIVE} < p.price_kobo then p.price_kobo else p.compare_at_kobo end)`;
/** A gift is shown/added only while it is active and its promo (if any) has not ended. */
const GIFT_LIVE = `g.is_active and (g.ends_at is null or now() < g.ends_at)`;
/** Units the product can actually ship: available stock summed across active hubs. */
const AVAILABLE_UNITS = `coalesce((select sum(greatest(inv.on_hand - inv.reserved, 0)) from public.inventory inv
     join public.hubs h on h.id = inv.hub_id where inv.product_id = p.id and h.is_active), 0)::int`;
/** Live bundle promo: promo price set and its deadline still ahead. */
const BUNDLE_PROMO_LIVE = `(b.promo_price_kobo is not null and b.promo_ends_at is not null and now() < b.promo_ends_at)`;
/** Live flash deal that really lowers the price. */
const FLASH_LIVE = `(fd.is_active and now() >= fd.starts_at and now() < fd.ends_at and fd.deal_price_kobo < p.price_kobo)`;

const CARD_SELECT = `
  p.id, p.slug, p.name, p.short_description as "shortDescription",
  ${EFFECTIVE} as "priceKobo",
  ${DISPLAY_COMPARE} as "compareAtKobo",
  p.rating_avg::float8 as "ratingAvg", p.review_count as "reviewCount", p.sold_count as "soldCount",
  (select url from public.product_images i where i.product_id = p.id order by sort_order limit 1) as "imageUrl",
  coalesce((select alt from public.product_images i where i.product_id = p.id order by sort_order limit 1), p.name) as "imageAlt",
  p.image_badge as "imageBadge", p.image_badge_style as "imageBadgeStyle", p.image_badge_icon as "imageBadgeIcon",
  p.perk_text as "perkText", p.perk_icon as "perkIcon", p.perk_style as "perkStyle",
  p.delivery_note as "deliveryNote", p.delivery_note_icon as "deliveryNoteIcon",
  p.pod_available as "podAvailable",
  (select g.name from public.free_gifts g where g.product_id = p.id and ${GIFT_LIVE} limit 1) as "giftName",
  c.slug as "categorySlug", c.name as "categoryName", p.curated_label as "curatedLabel",
  ${AVAILABLE_UNITS} as "availableUnits",
  coalesce((select min(inv.low_stock_threshold) from public.inventory inv join public.hubs h on h.id = inv.hub_id
             where inv.product_id = p.id and h.is_active), 0)::int as "lowStockThreshold",
  p.created_at as "createdAt",
  (select b.id from public.bundles b where b.product_id = p.id and b.is_active order by b.sort_order limit 1) as "defaultBundleId"
`;

export type SortKey = "popular" | "discount" | "newest" | "price_asc" | "price_desc";

export interface CatalogFilters {
  category?: string | null;
  minKobo?: number | null;
  maxKobo?: number | null;
  pod?: boolean;
  gift?: boolean;
  sameDay?: boolean;
  q?: string | null;
  sort?: SortKey;
  limit?: number;
  offset?: number;
}

const ORDER_BY: Record<SortKey, string> = {
  popular: `p.sold_count desc, p.review_count desc, p.rating_avg desc, p.created_at desc`,
  discount: `case when ${DISPLAY_COMPARE} > ${EFFECTIVE} then (${DISPLAY_COMPARE} - ${EFFECTIVE})::float8 / ${DISPLAY_COMPARE} else 0 end desc, p.created_at desc`,
  newest: `p.created_at desc`,
  price_asc: `public.effective_unit_price(p.id) asc, p.created_at desc`,
  price_desc: `public.effective_unit_price(p.id) desc, p.created_at desc`,
};

export function toTsQuery(q: string): string | null {
  const words = q
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 6);
  if (!words.length) return null;
  return words.map((w) => `${w.replace(/-/g, "")}:*`).filter((w) => w !== ":*").join(" & ") || null;
}

function buildWhere(f: CatalogFilters): { where: string; params: unknown[] } {
  const clauses = ["p.is_active"];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    clauses.push(sql.replace("?", `$${params.length}`));
  };
  if (f.category) add("c.slug = ?", f.category);
  if (f.minKobo != null) add("public.effective_unit_price(p.id) >= ?", f.minKobo);
  if (f.maxKobo != null) add("public.effective_unit_price(p.id) <= ?", f.maxKobo);
  if (f.pod) clauses.push("p.pod_available");
  if (f.gift) clauses.push(`exists (select 1 from public.free_gifts g where g.product_id = p.id and ${GIFT_LIVE})`);
  if (f.sameDay)
    clauses.push(
      `exists (select 1 from public.inventory inv join public.hubs h on h.id = inv.hub_id
                where inv.product_id = p.id and h.is_active and h.code in ('lagos','abuja') and inv.on_hand - inv.reserved > 0)`,
    );
  if (f.q) {
    const ts = toTsQuery(f.q);
    if (ts) {
      params.push(ts, `%${f.q.trim().slice(0, 60)}%`);
      clauses.push(
        `(p.search_vector @@ to_tsquery('english', $${params.length - 1}) or p.name ilike $${params.length})`,
      );
    }
  }
  return { where: clauses.join(" and "), params };
}

export async function listProducts(f: CatalogFilters): Promise<{ items: ProductCardData[]; total: number }> {
  const { where, params } = buildWhere(f);
  const limit = Math.min(Math.max(f.limit ?? 12, 1), 48);
  const offset = Math.max(f.offset ?? 0, 0);
  return asAnon(async (q) => {
    const items = await q.query<ProductCardData>(
      `select ${CARD_SELECT}
         from public.products p left join public.categories c on c.id = p.category_id
        where ${where}
        order by ${ORDER_BY[f.sort ?? "popular"]}
        limit ${limit} offset ${offset}`,
      params as never[],
    );
    const total = await q.query<{ n: number }>(
      `select count(*)::int as n from public.products p left join public.categories c on c.id = p.category_id where ${where}`,
      params as never[],
    );
    return { items, total: total[0]?.n ?? 0 };
  });
}

export interface CategoryData {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  emoji: string | null;
  icon: string;
  description: string | null;
  productCount: number;
}

export const getCategories = cache(async (): Promise<CategoryData[]> =>
  asAnon((q) =>
    q.query<CategoryData>(
      `select c.id, c.slug, c.name, c.short_name as "shortName", c.emoji, c.icon, c.description,
              (select count(*)::int from public.products p where p.category_id = c.id and p.is_active) as "productCount"
         from public.categories c where c.is_active order by c.sort_order, c.name`,
    ),
  ),
);

export async function countActiveProducts(): Promise<number> {
  const r = await asAnon((q) => q.query<{ n: number }>("select count(*)::int as n from public.products where is_active"));
  return r[0]?.n ?? 0;
}

export interface FlashDealCard extends ProductCardData {
  dealId: string;
  dealTitle: string | null;
  promoText: string | null;
  endsAt: string;
  /** Total units left across active hubs when at/below the low-stock threshold, else null. */
  lowStockUnits: number | null;
}

export async function getActiveFlashDeals(): Promise<FlashDealCard[]> {
  return asAnon((q) =>
    q.query<Omit<FlashDealCard, "lowStockUnits"> & { dealSort: number }>(
      `select * from (
         select distinct on (p.id) ${CARD_SELECT}, fd.id as "dealId", fd.title as "dealTitle", fd.promo_text as "promoText",
                fd.ends_at as "endsAt", fd.sort_order as "dealSort"
           from public.flash_deals fd
           join public.products p on p.id = fd.product_id
           left join public.categories c on c.id = p.category_id
          where p.is_active and ${FLASH_LIVE}
          order by p.id, fd.deal_price_kobo, fd.ends_at
       ) d
       order by d."dealSort", d."endsAt"`,
    ).then((rows) =>
      rows.map(({ dealSort: _sort, ...d }) => ({
        ...d,
        lowStockUnits: d.availableUnits > 0 && d.availableUnits <= d.lowStockThreshold ? d.availableUnits : null,
      })),
    ),
  );
}

export async function getCuratedProducts(limit = 6): Promise<ProductCardData[]> {
  return asAnon((q) =>
    q.query<ProductCardData>(
      `select ${CARD_SELECT} from public.products p left join public.categories c on c.id = p.category_id
        where p.is_active and p.curated_rank is not null order by p.curated_rank limit ${Math.min(limit, 24)}`,
    ),
  );
}

export interface ReviewData {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  authorName: string;
  location: string | null;
  rating: number;
  body: string;
  isVerifiedPurchase: boolean;
  isSample: boolean;
  createdAt: string;
}

async function sampleReviewsVisible(q: Queryable): Promise<boolean> {
  const r = await q.query<{ value: unknown }>("select value from public.settings where key = 'show_sample_reviews'");
  return r[0]?.value === true;
}

export async function getRecentReviews(opts: { productId?: string; limit?: number } = {}): Promise<ReviewData[]> {
  return asAnon(async (q) => {
    const showSamples = await sampleReviewsVisible(q);
    const params: unknown[] = [];
    let where = "r.status = 'approved'";
    if (!showSamples) where += " and not r.is_sample";
    if (opts.productId) {
      params.push(opts.productId);
      where += ` and r.product_id = $${params.length}`;
    }
    return q.query<ReviewData>(
      `select r.id, r.product_id as "productId", p.name as "productName", p.slug as "productSlug",
              r.author_name as "authorName", r.location, r.rating, r.body,
              r.is_verified_purchase as "isVerifiedPurchase", r.is_sample as "isSample", r.created_at as "createdAt"
         from public.reviews r join public.products p on p.id = r.product_id
        where ${where} order by r.is_verified_purchase desc, r.created_at desc limit ${Math.min(opts.limit ?? 6, 50)}`,
      params as never[],
    );
  });
}

export interface BundleData {
  id: string;
  label: string;
  shortLabel: string | null;
  description: string | null;
  quantity: number;
  /** Price charged right now: the live promo price, else the regular price. */
  priceKobo: number;
  /** Struck price: the regular price while a promo is live, else the admin compare-at (if any). */
  compareAtKobo: number | null;
  regularPriceKobo: number;
  /** End of the live bundle promo, null when no promo is running. */
  promoEndsAt: string | null;
  tag: string | null;
  sideTag: string | null;
  note: string | null;
  isPopular: boolean;
}

export interface HubStock {
  hubCode: string;
  hubName: string;
  available: number;
  lowStockThreshold: number;
}

export interface ProductDetail extends ProductCardData {
  description: string | null;
  basePriceKobo: number;
  warrantyMonths: number;
  specs: { label: string; value: string }[];
  images: { url: string; alt: string }[];
  features: { icon: string; title: string; description: string }[];
  faqs: { question: string; answer: string }[];
  bundles: BundleData[];
  /** Free gift, only while it is live (its promo has not ended). */
  gift: { name: string; valueKobo: number; imageUrl: string | null; conditions: string | null; endsAt: string | null } | null;
  stock: HubStock[];
  seoTitle: string | null;
  seoDescription: string | null;
  tags: string[];
  /** End of the live flash deal that lowers the price (null when none). */
  flashEndsAt: string | null;
  /**
   * The product's ONE promo deadline: the earliest live promo end among its bundles and flash deal.
   * Null when no promo is live — then no countdown and no promo/save copy anywhere.
   */
  promoEndsAt: string | null;
}

async function loadDetail(q: Queryable, where: string, param: string): Promise<ProductDetail | null> {
  const rows = await q.query<ProductDetail & { categoryId: string | null }>(
    `select ${CARD_SELECT}, p.description, p.price_kobo as "basePriceKobo", p.warranty_months as "warrantyMonths",
            p.specs, p.seo_title as "seoTitle", p.seo_description as "seoDescription", p.tags,
            (select min(fd.ends_at) from public.flash_deals fd where fd.product_id = p.id and ${FLASH_LIVE}) as "flashEndsAt",
            least(
              (select min(fd.ends_at) from public.flash_deals fd where fd.product_id = p.id and ${FLASH_LIVE}),
              (select min(b.promo_ends_at) from public.bundles b where b.product_id = p.id and b.is_active and ${BUNDLE_PROMO_LIVE})
            ) as "promoEndsAt"
       from public.products p left join public.categories c on c.id = p.category_id
      where ${where} and p.is_active`,
    [param],
  );
  const p = rows[0];
  if (!p) return null;
  const [images, features, faqs, bundles, gifts, stock] = await Promise.all([
    q.query<{ url: string; alt: string }>(
      "select url, alt from public.product_images where product_id = $1 order by sort_order",
      [p.id],
    ),
    q.query<{ icon: string; title: string; description: string }>(
      "select icon, title, description from public.product_features where product_id = $1 order by sort_order",
      [p.id],
    ),
    q.query<{ question: string; answer: string }>(
      "select question, answer from public.product_faqs where product_id = $1 order by sort_order",
      [p.id],
    ),
    q.query<BundleData>(
      `select b.id, b.label, b.short_label as "shortLabel", b.description, b.quantity,
              public.effective_bundle_price(b.id) as "priceKobo",
              case when ${BUNDLE_PROMO_LIVE} then b.price_kobo else b.compare_at_kobo end as "compareAtKobo",
              b.price_kobo as "regularPriceKobo",
              case when ${BUNDLE_PROMO_LIVE} then b.promo_ends_at end as "promoEndsAt",
              b.tag, b.side_tag as "sideTag", b.note, b.is_popular as "isPopular"
         from public.bundles b where b.product_id = $1 and b.is_active order by b.sort_order`,
      [p.id],
    ),
    q.query<NonNullable<ProductDetail["gift"]>>(
      `select g.name, g.value_kobo as "valueKobo", g.image_url as "imageUrl", g.conditions, g.ends_at as "endsAt"
         from public.free_gifts g where g.product_id = $1 and ${GIFT_LIVE} limit 1`,
      [p.id],
    ),
    q.query<HubStock>(
      `select h.code as "hubCode", h.name as "hubName", greatest(i.on_hand - i.reserved, 0)::int as available,
              i.low_stock_threshold as "lowStockThreshold"
         from public.inventory i join public.hubs h on h.id = i.hub_id
        where i.product_id = $1 and h.is_active order by h.sort_order`,
      [p.id],
    ),
  ]);
  return { ...p, images, features, faqs, bundles, gift: gifts[0] ?? null, stock };
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  return asAnon((q) => loadDetail(q, "p.slug = $1", slug));
}

export async function getProductById(id: string): Promise<ProductDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return asAnon((q) => loadDetail(q, "p.id = $1::uuid", id));
}

export async function getRelatedProducts(productId: string, categorySlug: string | null, limit = 4) {
  return asAnon((q) =>
    q.query<ProductCardData>(
      `select ${CARD_SELECT} from public.products p left join public.categories c on c.id = p.category_id
        where p.is_active and p.id <> $1 and ($2::text is null or c.slug = $2)
        order by p.sold_count desc, p.review_count desc, p.created_at desc limit ${Math.min(limit, 12)}`,
      [productId, categorySlug],
    ),
  );
}

export interface Suggestion {
  slug: string;
  name: string;
  priceKobo: number;
  imageUrl: string | null;
}

export async function searchSuggestions(term: string, limit = 6): Promise<Suggestion[]> {
  const ts = toTsQuery(term);
  if (!ts) return [];
  return asAnon((q) =>
    q.query<Suggestion>(
      `select p.slug, p.name, public.effective_unit_price(p.id) as "priceKobo",
              (select url from public.product_images i where i.product_id = p.id order by sort_order limit 1) as "imageUrl"
         from public.products p
        where p.is_active and (p.search_vector @@ to_tsquery('english', $1) or p.name ilike $2)
        order by ts_rank(p.search_vector, to_tsquery('english', $1)) desc, p.sold_count desc
        limit ${Math.min(limit, 10)}`,
      [ts, `%${term.trim().slice(0, 60)}%`],
    ),
  );
}

export async function getAllProductSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  return asAnon((q) =>
    q.query<{ slug: string; updatedAt: string }>(
      `select slug, updated_at as "updatedAt" from public.products where is_active order by slug`,
    ),
  );
}

/** Largest real discount (same rule as the struck price on cards) — powers "{max_discount}" in hero copy. */
export async function maxActiveDiscountPercent(): Promise<number> {
  const r = await asAnon((q) =>
    q.query<{ pct: number | null }>(
      `select max(round(((cmp - eff) * 100.0) / cmp))::int as pct
         from (select ${EFFECTIVE} as eff, ${DISPLAY_COMPARE} as cmp from public.products p where p.is_active) x
        where cmp > eff`,
    ),
  );
  return r[0]?.pct ?? 0;
}
