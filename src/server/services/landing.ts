import "server-only";
import { asAnon } from "../db";
import { autoLandingPage } from "@/lib/landing-auto";
import { getProductById, getProductBySlug, getRecentReviews, type ProductDetail, type ReviewData } from "./catalog";

export interface LandingPageData {
  /** Null for an automatic page (product without a custom landing page). */
  id: string | null;
  slug: string;
  isPublished: boolean;
  hookLabel: string;
  hookBanner: string | null;
  trendBadge: string | null;
  headline: string;
  subheadline: string | null;
  heroOverlayText: string | null;
  heroOverlayIcon: string | null;
  warrantyBadge: string | null;
  regionsText: string | null;
  campaignEndsAt: string | null;
  featuresTitle: string | null;
  featuresSubtitle: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
  videoTitle: string | null;
  videoSubtitle: string | null;
  ctaLabel: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  productId: string;
  sections: { id: string; kind: string; title: string | null; items: { icon: string; title: string; body: string }[]; body: string | null }[];
}

export interface LandingBundle {
  lp: LandingPageData;
  product: ProductDetail;
  reviews: ReviewData[];
}

export async function getLandingPage(slug: string, opts: { preview?: boolean } = {}): Promise<LandingBundle | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const rows = await selectLandingPages("slug = $1", slug);
  const lp = rows[0];
  if (!lp) return opts.preview ? null : getAutoLandingPage(slug);
  if (!lp.isPublished && !opts.preview) return null;
  const [product, reviews] = await Promise.all([
    getProductById(lp.productId),
    getRecentReviews({ productId: lp.productId, limit: 6 }),
  ]);
  if (!product) return null;
  return { lp, product, reviews };
}

/** `where` is a fixed SQL fragment from this file (never user input); the value goes in `$1`. */
function selectLandingPages(where: string, param: string) {
  return asAnon((q) => q.query<LandingPageData>(`select id, slug, is_published as "isPublished", hook_label as "hookLabel", hook_banner as "hookBanner",
              trend_badge as "trendBadge", headline, subheadline, hero_overlay_text as "heroOverlayText",
              hero_overlay_icon as "heroOverlayIcon", warranty_badge as "warrantyBadge", regions_text as "regionsText",
              campaign_ends_at as "campaignEndsAt", features_title as "featuresTitle", features_subtitle as "featuresSubtitle",
              video_url as "videoUrl", video_poster_url as "videoPosterUrl", video_title as "videoTitle",
              video_subtitle as "videoSubtitle", cta_label as "ctaLabel", seo_title as "seoTitle",
              seo_description as "seoDescription", og_image_url as "ogImageUrl", product_id as "productId",
              coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'title', s.title, 'items', s.items, 'body', s.body)
                                         order by s.sort_order)
                          from public.landing_page_sections s where s.landing_page_id = lp.id and s.is_visible), '[]'::jsonb) as sections
         from public.landing_pages lp where ${where}`, [param]));
}

/**
 * `/lp/<product-slug>` for a product without a landing page at that address: its published custom
 * page if it has one (canonical stays on that page's own slug), otherwise a page built from the product.
 */
async function getAutoLandingPage(productSlug: string): Promise<LandingBundle | null> {
  const product = await getProductBySlug(productSlug);
  if (!product) return null;
  const [custom] = await selectLandingPages("product_id = $1::uuid and is_published order by created_at limit 1", product.id);
  const reviews = await getRecentReviews({ productId: product.id, limit: 6 });
  return { lp: custom ?? autoLandingPage(product), product, reviews };
}
