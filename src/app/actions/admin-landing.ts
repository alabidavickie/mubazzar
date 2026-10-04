"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asUser } from "@/server/db";
import { requireRole } from "@/server/session";
import { auditAdmin } from "@/server/services/admin-audit";
import { landingInput, type LandingInput } from "@/lib/schemas/landing";

export type SaveLandingResult = { ok: true; id: string; slug: string; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Creates/updates an ad landing page and its sections (one transaction, as the admin). */
export async function saveLandingAction(input: LandingInput): Promise<SaveLandingResult> {
  const session = await requireRole(["admin"], "/admin/landing-pages");
  const parsed = landingInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { ok: false, error: Object.values(fieldErrors)[0] ?? "Please check the form.", fieldErrors };
  }
  const d = parsed.data;
  let id: string;
  try {
    id = await asUser(session.userId, async (q) => {
      const cols = [
        d.slug, d.productId, d.isPublished, d.hookLabel, d.hookBanner, d.trendBadge, d.headline, d.subheadline, d.heroOverlayText,
        d.heroOverlayIcon, d.warrantyBadge, d.regionsText, d.campaignEndsAt, d.featuresTitle, d.featuresSubtitle, d.videoUrl,
        d.videoPosterUrl, d.videoTitle, d.videoSubtitle, d.ctaLabel, d.seoTitle, d.seoDescription, d.ogImageUrl,
      ] as const;
      let lpId: string;
      if (d.id) {
        const rows = await q.query<{ id: string }>(
          `update public.landing_pages set slug = $1, product_id = $2, is_published = $3, hook_label = $4, hook_banner = $5, trend_badge = $6,
                  headline = $7, subheadline = $8, hero_overlay_text = $9, hero_overlay_icon = $10, warranty_badge = $11, regions_text = $12,
                  campaign_ends_at = $13, features_title = $14, features_subtitle = $15, video_url = $16, video_poster_url = $17,
                  video_title = $18, video_subtitle = $19, cta_label = $20, seo_title = $21, seo_description = $22, og_image_url = $23
            where id = $24 returning id`,
          [...cols, d.id],
        );
        if (!rows[0]) throw new Error("NOT_FOUND");
        lpId = rows[0].id;
      } else {
        const rows = await q.query<{ id: string }>(
          `insert into public.landing_pages (slug, product_id, is_published, hook_label, hook_banner, trend_badge, headline, subheadline,
                  hero_overlay_text, hero_overlay_icon, warranty_badge, regions_text, campaign_ends_at, features_title, features_subtitle,
                  video_url, video_poster_url, video_title, video_subtitle, cta_label, seo_title, seo_description, og_image_url)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) returning id`,
          [...cols],
        );
        lpId = rows[0]!.id;
      }
      await q.query("delete from public.landing_page_sections where landing_page_id = $1", [lpId]);
      for (const [i, s] of d.sections.entries()) {
        await q.query(
          "insert into public.landing_page_sections (landing_page_id, kind, title, body, items, is_visible, sort_order) values ($1, $2, $3, $4, $5::jsonb, $6, $7)",
          [lpId, s.kind, s.title, s.body, JSON.stringify(s.items), s.isVisible, i],
        );
      }
      return lpId;
    });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code === "23505") return { ok: false, error: "Another landing page already uses that link.", fieldErrors: { slug: "Link already used" } };
    if (e.code === "23503") return { ok: false, error: "That product no longer exists.", fieldErrors: { productId: "Choose a product" } };
    if (e.message === "NOT_FOUND") return { ok: false, error: "That landing page no longer exists." };
    console.error("[landing] save failed", err);
    return { ok: false, error: "Couldn't save the landing page. Please try again." };
  }
  await auditAdmin(session.userId, d.id ? "landing.update" : "landing.create", "landing_page", id, { slug: d.slug, published: d.isPublished });
  revalidatePath(`/lp/${d.slug}`);
  revalidatePath("/admin/landing-pages");
  revalidatePath("/sitemap.xml");
  return { ok: true, id, slug: d.slug, message: d.id ? "Landing page saved." : "Landing page created." };
}

const publishSchema = z.object({ id: z.uuid(), publish: z.boolean() });

export async function setLandingPublishedAction(input: z.input<typeof publishSchema>): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole(["admin"], "/admin/landing-pages");
  const p = publishSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request." };
  const rows = await asUser(session.userId, (q) =>
    q.query<{ slug: string }>("update public.landing_pages set is_published = $2 where id = $1 returning slug", [p.data.id, p.data.publish]),
  );
  if (!rows[0]) return { ok: false, error: "Not found." };
  await auditAdmin(session.userId, p.data.publish ? "landing.publish" : "landing.unpublish", "landing_page", p.data.id, { slug: rows[0].slug });
  revalidatePath(`/lp/${rows[0].slug}`);
  revalidatePath("/admin/landing-pages");
  revalidatePath("/sitemap.xml");
  return { ok: true };
}
