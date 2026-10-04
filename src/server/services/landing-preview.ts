import "server-only";
import { asUser } from "../db";
import { getSession, STAFF_ROLES } from "../session";
import { getProductById, getRecentReviews } from "./catalog";
import type { LandingBundle, LandingPageData } from "./landing";

/**
 * Admin/staff preview of a landing page (published or not). The page row is read as the signed-in
 * user so RLS (`landing_pages_read`: is_published or is_staff()) decides — never as service role.
 * Returns null for guests, customers and other roles.
 */
export async function getLandingPreview(slug: string): Promise<LandingBundle | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const session = await getSession();
  if (!session || !STAFF_ROLES.includes(session.role)) return null;
  const rows = await asUser(
    session.userId,
    (q) =>
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
    session.email,
  );
  const lp = rows[0];
  if (!lp) return null;
  const [product, reviews] = await Promise.all([
    getProductById(lp.productId),
    getRecentReviews({ productId: lp.productId, limit: 6 }),
  ]);
  if (!product) return null;
  return { lp, product, reviews };
}
