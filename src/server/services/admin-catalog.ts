import "server-only";
import { asUser } from "../db";
import type { Session } from "../session";
import { koboToNairaInput } from "@/lib/money";
import { utcToLagosLocal } from "@/lib/time";
import type { ProductInput } from "@/lib/schemas/product";

/** Admin catalogue read models (RLS: admin sees inactive products, bundles and gifts too). */

export interface AdminProductRow {
  id: string;
  slug: string;
  name: string;
  priceKobo: number;
  isActive: boolean;
  categoryName: string | null;
  imageUrl: string | null;
  available: number;
  bundleCount: number;
  landingCount: number;
  updatedAt: string;
}

export async function listAdminProducts(session: Session, q: string | null): Promise<AdminProductRow[]> {
  return asUser(session.userId, (db) =>
    db.query<AdminProductRow>(
      `select p.id, p.slug, p.name, p.price_kobo as "priceKobo", p.is_active as "isActive", c.name as "categoryName",
              (select url from public.product_images i where i.product_id = p.id order by sort_order limit 1) as "imageUrl",
              coalesce((select sum(greatest(on_hand - reserved, 0)) from public.inventory inv where inv.product_id = p.id), 0)::int as available,
              (select count(*)::int from public.bundles b where b.product_id = p.id and b.is_active) as "bundleCount",
              (select count(*)::int from public.landing_pages lp where lp.product_id = p.id) as "landingCount",
              p.updated_at as "updatedAt"
         from public.products p left join public.categories c on c.id = p.category_id
        where ($1::text is null or p.name ilike '%' || $1 || '%' or p.slug ilike '%' || $1 || '%' or p.sku ilike $1)
        order by p.is_active desc, p.updated_at desc limit 200`,
      [q?.trim() || null],
    ),
  );
}

export interface EditorOptions {
  categories: { id: string; name: string }[];
  hubs: { id: string; code: string; name: string }[];
}

export async function getEditorOptions(session: Session): Promise<EditorOptions> {
  return asUser(session.userId, async (db) => ({
    categories: await db.query<{ id: string; name: string }>("select id, name from public.categories order by sort_order, name"),
    hubs: await db.query<{ id: string; code: string; name: string }>("select id, code, name from public.hubs where is_active order by sort_order, code"),
  }));
}

export interface EditableImage {
  id: string;
  url: string;
  alt: string;
}

/** Product → editor form values (naira text, Lagos local datetimes) + its images. */
export async function getProductForEdit(
  session: Session,
  id: string,
): Promise<{ values: ProductInput; images: EditableImage[]; stock: { hubId: string; onHand: number; reserved: number; threshold: number }[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return asUser(session.userId, async (db) => {
    const [p] = await db.query<{
      id: string; slug: string; name: string; shortDescription: string | null; description: string | null; categoryId: string | null;
      priceKobo: number; compareAtKobo: number | null; sku: string | null; tags: string[]; imageBadge: string | null;
      imageBadgeStyle: "navy" | "emerald" | "gold" | "bronze" | "red"; imageBadgeIcon: string | null; perkText: string | null;
      perkIcon: string | null; perkStyle: "gold" | "neutral"; deliveryNote: string | null; deliveryNoteIcon: string | null;
      podAvailable: boolean; warrantyMonths: number; isActive: boolean; curatedRank: number | null; curatedLabel: string | null;
      seoTitle: string | null; seoDescription: string | null; specs: { label: string; value: string }[];
    }>(
      `select id, slug, name, short_description as "shortDescription", description, category_id as "categoryId",
              price_kobo as "priceKobo", compare_at_kobo as "compareAtKobo", sku, tags, image_badge as "imageBadge",
              image_badge_style as "imageBadgeStyle", image_badge_icon as "imageBadgeIcon", perk_text as "perkText",
              perk_icon as "perkIcon", perk_style as "perkStyle", delivery_note as "deliveryNote",
              delivery_note_icon as "deliveryNoteIcon", pod_available as "podAvailable", warranty_months as "warrantyMonths",
              is_active as "isActive", curated_rank as "curatedRank", curated_label as "curatedLabel",
              seo_title as "seoTitle", seo_description as "seoDescription", specs
         from public.products where id = $1`,
      [id],
    );
    if (!p) return null;
    const [images, features, faqs, bundles, gifts, stock] = await Promise.all([
      db.query<EditableImage>("select id, url, alt from public.product_images where product_id = $1 order by sort_order, created_at", [id]),
      db.query<{ icon: string; title: string; description: string }>("select icon, title, description from public.product_features where product_id = $1 order by sort_order", [id]),
      db.query<{ question: string; answer: string }>("select question, answer from public.product_faqs where product_id = $1 order by sort_order", [id]),
      db.query<{
        id: string; label: string; shortLabel: string | null; description: string | null; quantity: number; priceKobo: number;
        compareAtKobo: number | null; promoPriceKobo: number | null; promoEndsAt: string | null; tag: string | null;
        sideTag: string | null; note: string | null; isPopular: boolean; isActive: boolean;
      }>(
        `select id, label, short_label as "shortLabel", description, quantity, price_kobo as "priceKobo", compare_at_kobo as "compareAtKobo",
                promo_price_kobo as "promoPriceKobo", promo_ends_at as "promoEndsAt", tag, side_tag as "sideTag", note,
                is_popular as "isPopular", is_active as "isActive"
           from public.bundles where product_id = $1 order by is_active desc, sort_order, created_at`,
        [id],
      ),
      db.query<{ name: string; valueKobo: number; imageUrl: string | null; conditions: string | null; endsAt: string | null }>(
        `select name, value_kobo as "valueKobo", image_url as "imageUrl", conditions, ends_at as "endsAt"
           from public.free_gifts where product_id = $1 and is_active limit 1`,
        [id],
      ),
      db.query<{ hubId: string; onHand: number; reserved: number; threshold: number }>(
        `select h.id as "hubId", coalesce(i.on_hand, 0) as "onHand", coalesce(i.reserved, 0) as reserved, coalesce(i.low_stock_threshold, 10) as threshold
           from public.hubs h left join public.inventory i on i.hub_id = h.id and i.product_id = $1
          where h.is_active order by h.sort_order, h.code`,
        [id],
      ),
    ]);
    const n = (k: number | null) => (k === null ? "" : koboToNairaInput(Number(k)));
    const gift = gifts[0];
    const values: ProductInput = {
      id: p.id,
      name: p.name,
      slug: p.slug,
      shortDescription: p.shortDescription ?? "",
      description: p.description ?? "",
      categoryId: p.categoryId,
      price: n(p.priceKobo),
      compareAt: n(p.compareAtKobo),
      sku: p.sku ?? "",
      tags: p.tags.join(", "),
      imageBadge: p.imageBadge ?? "",
      imageBadgeStyle: p.imageBadgeStyle,
      imageBadgeIcon: p.imageBadgeIcon ?? "",
      perkText: p.perkText ?? "",
      perkIcon: p.perkIcon ?? "",
      perkStyle: p.perkStyle,
      deliveryNote: p.deliveryNote ?? "",
      deliveryNoteIcon: p.deliveryNoteIcon ?? "",
      podAvailable: p.podAvailable,
      warrantyMonths: p.warrantyMonths,
      isActive: p.isActive,
      curatedRank: p.curatedRank,
      curatedLabel: p.curatedLabel ?? "",
      seoTitle: p.seoTitle ?? "",
      seoDescription: p.seoDescription ?? "",
      specs: Array.isArray(p.specs) ? p.specs : [],
      features: features.map((f) => ({ icon: f.icon, title: f.title, description: f.description })),
      faqs,
      images: images.map((i) => ({ id: i.id, alt: i.alt })),
      bundles: bundles.map((b) => ({
        id: b.id,
        label: b.label,
        shortLabel: b.shortLabel ?? "",
        description: b.description ?? "",
        quantity: b.quantity,
        price: n(b.priceKobo),
        compareAt: n(b.compareAtKobo),
        promoPrice: n(b.promoPriceKobo),
        promoEndsAt: utcToLagosLocal(b.promoEndsAt),
        tag: b.tag ?? "",
        sideTag: b.sideTag ?? "",
        note: b.note ?? "",
        isPopular: b.isPopular,
        isActive: b.isActive,
      })),
      gift: gift
        ? { name: gift.name, value: n(Number(gift.valueKobo) || null), imageUrl: gift.imageUrl ?? "", conditions: gift.conditions ?? "", endsAt: utcToLagosLocal(gift.endsAt) }
        : null,
      stock: stock.map((s) => ({ hubId: s.hubId, onHand: s.onHand, threshold: s.threshold })),
    };
    return { values, images, stock };
  });
}
