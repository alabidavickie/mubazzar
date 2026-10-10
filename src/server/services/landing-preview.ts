import "server-only";
import { asUser } from "../db";
import { getSession, STAFF_ROLES } from "../session";
import { getProductAsStaff, getRecentReviews } from "./catalog";
import { landingForProduct, type LandingBundle, type LandingPageData } from "./landing";

/**
 * Admin/staff preview of a landing page (published or not, product visible or still a draft). Everything
 * is read as the signed-in user so RLS (`landing_pages_read`: is_published or is_staff(); `products_read`:
 * is_active or is_staff()) decides — never as service role. Returns null for guests, customers and other roles.
 */
export async function getLandingPreview(slug: string): Promise<LandingBundle | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const session = await getSession();
  if (!session || !STAFF_ROLES.includes(session.role)) return null;
  return loadLandingPreview(session, slug);
}

/** The data half of the preview, free of cookies so it can be integration-tested. The caller has checked the role. */
export async function loadLandingPreview(session: { userId: string; email: string | null }, slug: string): Promise<LandingBundle | null> {
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
  if (lp) {
    const [found, reviews] = await Promise.all([
      getProductAsStaff(session, { id: lp.productId }),
      getRecentReviews({ productId: lp.productId, limit: 6 }),
    ]);
    if (!found) return null;
    return { lp, product: found.product, reviews, isDraft: !found.isActive };
  }
  // No page row at this address: preview the product's own page (what /lp/<product-slug> shows once it is visible).
  const found = await getProductAsStaff(session, { slug });
  if (!found) return null;
  return { ...(await landingForProduct(found.product)), isDraft: !found.isActive };
}
