import "server-only";
import { asUser } from "../db";
import type { Session } from "../session";
import { utcToLagosLocal } from "@/lib/time";
import type { LandingInput } from "@/lib/schemas/landing";

export interface LandingListRow {
  id: string;
  slug: string;
  headline: string;
  isPublished: boolean;
  productName: string;
  productActive: boolean;
  orders: number;
  updatedAt: string;
}

export async function listLandingPages(session: Session): Promise<LandingListRow[]> {
  return asUser(session.userId, (q) =>
    q.query<LandingListRow>(
      `select lp.id, lp.slug, lp.headline, lp.is_published as "isPublished", p.name as "productName", p.is_active as "productActive",
              (select count(*)::int from public.orders o where o.landing_page_id = lp.id) as orders, lp.updated_at as "updatedAt"
         from public.landing_pages lp join public.products p on p.id = lp.product_id
        order by lp.updated_at desc`,
    ),
  );
}

export async function landingProductOptions(session: Session) {
  return asUser(session.userId, (q) =>
    q.query<{ id: string; name: string; slug: string; isActive: boolean }>(
      `select id, name, slug, is_active as "isActive" from public.products order by is_active desc, name`,
    ),
  );
}

export async function getLandingForEdit(session: Session, id: string): Promise<LandingInput | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return asUser(session.userId, async (q) => {
    const [lp] = await q.query<Record<string, string | boolean | null>>(
      `select id, slug, product_id as "productId", is_published as "isPublished", hook_label as "hookLabel", hook_banner as "hookBanner",
              trend_badge as "trendBadge", headline, subheadline, hero_overlay_text as "heroOverlayText", hero_overlay_icon as "heroOverlayIcon",
              warranty_badge as "warrantyBadge", regions_text as "regionsText", campaign_ends_at as "campaignEndsAt",
              features_title as "featuresTitle", features_subtitle as "featuresSubtitle", video_url as "videoUrl",
              video_poster_url as "videoPosterUrl", video_title as "videoTitle", video_subtitle as "videoSubtitle",
              cta_label as "ctaLabel", seo_title as "seoTitle", seo_description as "seoDescription", og_image_url as "ogImageUrl"
         from public.landing_pages where id = $1`,
      [id],
    );
    if (!lp) return null;
    const sections = await q.query<{ kind: "trust_matrix" | "custom_text"; title: string | null; body: string | null; items: { icon: string; title: string; body: string }[]; isVisible: boolean }>(
      `select kind, title, body, items, is_visible as "isVisible" from public.landing_page_sections where landing_page_id = $1 order by sort_order`,
      [id],
    );
    const s = (k: string) => (lp[k] as string | null) ?? "";
    return {
      id: lp.id as string,
      slug: s("slug"),
      productId: s("productId"),
      isPublished: Boolean(lp.isPublished),
      hookLabel: s("hookLabel"),
      hookBanner: s("hookBanner"),
      trendBadge: s("trendBadge"),
      headline: s("headline"),
      subheadline: s("subheadline"),
      heroOverlayText: s("heroOverlayText"),
      heroOverlayIcon: s("heroOverlayIcon"),
      warrantyBadge: s("warrantyBadge"),
      regionsText: s("regionsText"),
      campaignEndsAt: utcToLagosLocal(lp.campaignEndsAt as string | null),
      featuresTitle: s("featuresTitle"),
      featuresSubtitle: s("featuresSubtitle"),
      videoUrl: s("videoUrl"),
      videoPosterUrl: s("videoPosterUrl"),
      videoTitle: s("videoTitle"),
      videoSubtitle: s("videoSubtitle"),
      ctaLabel: s("ctaLabel"),
      seoTitle: s("seoTitle"),
      seoDescription: s("seoDescription"),
      ogImageUrl: s("ogImageUrl"),
      sections: sections.map((x) => ({ kind: x.kind, title: x.title ?? "", body: x.body ?? "", items: Array.isArray(x.items) ? x.items : [], isVisible: x.isVisible })),
    };
  });
}
