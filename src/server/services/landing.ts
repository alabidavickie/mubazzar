import "server-only";
import { asAnon } from "../db";
import { getProductById, getRecentReviews, type ProductDetail, type ReviewData } from "./catalog";

export interface LandingPageData {
  id: string;
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
  const rows = await asAnon((q) =>
    q.query<LandingPageData>(
      `select id, slug, is_published as "isPublished", hook_label as "hookLabel", hook_banner as "hookBanner",
              trend_badge as "trendBadge", headline, subheadline, hero_overlay_text as "heroOverlayText",
              hero_overlay_icon as "heroOverlayIcon", warranty_badge as "warrantyBadge", regions_text as "regionsText",
              campaign_ends_at as "campaignEndsAt", features_title as "featuresTitle", features_subtitle as "featuresSubtitle",
              video_url as "videoUrl", video_poster_url as "videoPosterUrl", video_title as "videoTitle",
              video_subtitle as "videoSubtitle", cta_label as "ctaLabel", seo_title as "seoTitle",
              seo_description as "seoDescription", og_image_url as "ogImageUrl", product_id as "productId",
              coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'title', s.title, 'items', s.items, 'body', s.body)
                                         order by s.sort_order)
                          from public.landing_page_sections s where s.landing_page_id = lp.id and s.is_visible), '[]'::jsonb) as sections
         from public.landing_pages lp where slug = $1`,
      [slug],
    ),
  );
  const lp = rows[0];
  if (!lp || (!lp.isPublished && !opts.preview)) return null;
  const [product, reviews] = await Promise.all([
    getProductById(lp.productId),
    getRecentReviews({ productId: lp.productId, limit: 6 }),
  ]);
  if (!product) return null;
  return { lp, product, reviews };
}
