import "server-only";
import { cache } from "react";
import { asAnon } from "../db";
import { listProducts, type ProductCardData, type SortKey } from "./catalog";
import { priceBoundsKobo, visibleLimit, type CatalogState } from "@/lib/catalog-params";

/** Storefront read models beyond the shared catalog service. Every query runs as `anon` (RLS applies). */

const CHUNK = 48; // listProducts caps a single page at 48 rows

/** Items 1..page*12 for the given URL state (Load More renders cumulatively) + the real total. */
export async function listCatalog(
  state: CatalogState,
  overrides: { category?: string | null } = {},
): Promise<{ items: ProductCardData[]; total: number }> {
  const { minKobo, maxKobo } = priceBoundsKobo(state);
  const filters = {
    category: overrides.category !== undefined ? overrides.category : state.category,
    minKobo,
    maxKobo,
    pod: state.pod,
    gift: state.gift,
    sameDay: state.sameday,
    q: state.q,
    sort: state.sort as SortKey,
  };
  const want = visibleLimit(state);
  const chunks = Math.ceil(want / CHUNK);
  const results = await Promise.all(
    Array.from({ length: chunks }, (_, i) =>
      listProducts({ ...filters, offset: i * CHUNK, limit: Math.min(CHUNK, want - i * CHUNK) }),
    ),
  );
  return { items: results.flatMap((r) => r.items), total: results[0]?.total ?? 0 };
}

export interface HubSummary {
  code: string;
  name: string;
  city: string | null;
}

export const getHubs = cache(async (): Promise<HubSummary[]> =>
  asAnon((q) =>
    q.query<HubSummary>(`select code, name, city from public.hubs where is_active order by sort_order, name`),
  ),
);

export interface ReviewSummary {
  /** Approved reviews visible on the site (sample reviews included only where the admin shows them). */
  count: number;
  average: number;
  /** count per star, index 0 = 5 stars … index 4 = 1 star */
  distribution: number[];
  sampleCount: number;
  /** Real (non-sample) approved reviews only — the ONLY numbers allowed in structured data. */
  real: { count: number; average: number };
}

/** Review summary for a product page. Sample reviews never feed `real` (JSON-LD aggregateRating). */
export async function getProductReviewSummary(productId: string): Promise<ReviewSummary> {
  return asAnon(async (q) => {
    const s = await q.query<{ value: unknown }>("select value from public.settings where key = 'show_sample_reviews'");
    const showSamples = s[0]?.value === true;
    const rows = await q.query<{ rating: number; isSample: boolean; n: number }>(
      `select rating::int as rating, is_sample as "isSample", count(*)::int as n
         from public.reviews where product_id = $1::uuid and status = 'approved'
        group by rating, is_sample`,
      [productId],
    );
    const distribution = [0, 0, 0, 0, 0];
    let count = 0;
    let sum = 0;
    let sampleCount = 0;
    let realCount = 0;
    let realSum = 0;
    for (const r of rows) {
      if (!r.isSample) {
        realCount += r.n;
        realSum += r.rating * r.n;
      }
      if (r.isSample && !showSamples) continue;
      if (r.isSample) sampleCount += r.n;
      count += r.n;
      sum += r.rating * r.n;
      distribution[5 - r.rating] = (distribution[5 - r.rating] ?? 0) + r.n;
    }
    const round1 = (v: number) => Math.round(v * 10) / 10;
    return {
      count,
      average: count ? round1(sum / count) : 0,
      distribution,
      sampleCount,
      real: { count: realCount, average: realCount ? round1(realSum / realCount) : 0 },
    };
  });
}

/** Published landing pages for the sitemap. */
export async function getPublishedLandingSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  return asAnon((q) =>
    q.query<{ slug: string; updatedAt: string }>(
      `select slug, updated_at as "updatedAt" from public.landing_pages where is_published order by slug`,
    ),
  );
}
