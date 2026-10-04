"use server";

import { asUser } from "@/server/db";
import { parseAppError } from "@/server/db/types-core";
import { requireRole } from "@/server/session";
import { uploadImage, validateImage } from "@/server/adapters/storage";
import { productInput, type ProductInput } from "@/lib/schemas/product";
import { auditAdmin, revalidateCatalog } from "@/server/services/admin-audit";
import { getProductForEdit } from "@/server/services/admin-catalog";

export type SaveProductResult =
  | { ok: true; id: string; slug: string; message: string; values?: ProductInput; images?: { id: string; url: string; alt: string }[] }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[i.path.map(String).join(".")] ??= i.message;
  return out;
}

/**
 * Creates/updates a product with its specs, features, FAQs, image order/alt text, bundles, free gift and
 * per-hub stock in ONE transaction as the admin (RLS + adjust_inventory's audit). Bundles removed in the
 * editor are deactivated, never deleted (past orders and saved carts reference them).
 */
export async function saveProductAction(input: ProductInput): Promise<SaveProductResult> {
  const session = await requireRole(["admin"], "/admin/products");
  const parsed = productInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error.issues);
    return { ok: false, error: Object.values(fieldErrors)[0] ?? "Please check the form.", fieldErrors };
  }
  const p = parsed.data;
  let id: string;
  try {
    id = await asUser(session.userId, async (q) => {
      const cols = [
        p.slug, p.name, p.shortDescription, p.description, p.categoryId, p.price, p.compareAt, p.sku, p.tags,
        p.imageBadge, p.imageBadgeStyle, p.imageBadgeIcon, p.perkText, p.perkIcon, p.perkStyle, p.deliveryNote,
        p.deliveryNoteIcon, p.podAvailable, p.warrantyMonths, p.isActive, p.curatedRank, p.curatedLabel, p.seoTitle,
        p.seoDescription, JSON.stringify(p.specs),
      ] as const;
      let productId: string;
      if (p.id) {
        const rows = await q.query<{ id: string }>(
          `update public.products set slug = $1, name = $2, short_description = $3, description = $4, category_id = $5,
                  price_kobo = $6, compare_at_kobo = $7, sku = $8, tags = $9, image_badge = $10, image_badge_style = $11,
                  image_badge_icon = $12, perk_text = $13, perk_icon = $14, perk_style = $15, delivery_note = $16,
                  delivery_note_icon = $17, pod_available = $18, warranty_months = $19, is_active = $20, curated_rank = $21,
                  curated_label = $22, seo_title = $23, seo_description = $24, specs = $25::jsonb
            where id = $26 returning id`,
          [...cols, p.id],
        );
        if (!rows[0]) throw new Error("PRODUCT_NOT_FOUND");
        productId = rows[0].id;
      } else {
        const rows = await q.query<{ id: string }>(
          `insert into public.products (slug, name, short_description, description, category_id, price_kobo, compare_at_kobo, sku, tags,
                  image_badge, image_badge_style, image_badge_icon, perk_text, perk_icon, perk_style, delivery_note, delivery_note_icon,
                  pod_available, warranty_months, is_active, curated_rank, curated_label, seo_title, seo_description, specs)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25::jsonb)
           returning id`,
          [...cols],
        );
        productId = rows[0]!.id;
      }

      await q.query("delete from public.product_features where product_id = $1", [productId]);
      for (const [i, f] of p.features.entries()) {
        await q.query("insert into public.product_features (product_id, icon, title, description, sort_order) values ($1, $2, $3, $4, $5)", [
          productId, f.icon, f.title, f.description, i,
        ]);
      }
      await q.query("delete from public.product_faqs where product_id = $1", [productId]);
      for (const [i, f] of p.faqs.entries()) {
        await q.query("insert into public.product_faqs (product_id, question, answer, sort_order) values ($1, $2, $3, $4)", [productId, f.question, f.answer, i]);
      }

      // Images: keep the listed ones (in this order, with alt text); remove the rest.
      const keep = p.images.map((i) => i.id);
      await q.query("delete from public.product_images where product_id = $1 and not (id = any($2::uuid[]))", [productId, keep]);
      for (const [i, img] of p.images.entries()) {
        await q.query("update public.product_images set alt = $1, sort_order = $2 where id = $3 and product_id = $4", [img.alt, i, img.id, productId]);
      }

      // Bundles: upsert by id; deactivate the ones no longer listed.
      const kept: string[] = [];
      for (const [i, b] of p.bundles.entries()) {
        const vals = [b.label, b.shortLabel, b.description, b.quantity, b.price, b.compareAt, b.promoPrice, b.promoEndsAt, b.tag, b.sideTag, b.note, b.isPopular, b.isActive, i] as const;
        if (b.id) {
          const rows = await q.query<{ id: string }>(
            `update public.bundles set label = $1, short_label = $2, description = $3, quantity = $4, price_kobo = $5, compare_at_kobo = $6,
                    promo_price_kobo = $7, promo_ends_at = $8, tag = $9, side_tag = $10, note = $11, is_popular = $12, is_active = $13, sort_order = $14
              where id = $15 and product_id = $16 returning id`,
            [...vals, b.id, productId],
          );
          if (rows[0]) {
            kept.push(rows[0].id);
            continue;
          }
        }
        const rows = await q.query<{ id: string }>(
          `insert into public.bundles (label, short_label, description, quantity, price_kobo, compare_at_kobo, promo_price_kobo, promo_ends_at,
                  tag, side_tag, note, is_popular, is_active, sort_order, product_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) returning id`,
          [...vals, productId],
        );
        kept.push(rows[0]!.id);
      }
      await q.query("update public.bundles set is_active = false, is_popular = false where product_id = $1 and not (id = any($2::uuid[]))", [productId, kept]);

      // Free gift: one active row per product.
      if (!p.gift) {
        await q.query("update public.free_gifts set is_active = false where product_id = $1 and is_active", [productId]);
      } else {
        const g = p.gift;
        const updated = await q.query<{ id: string }>(
          `update public.free_gifts set name = $2, value_kobo = $3, image_url = $4, conditions = $5, ends_at = $6
            where product_id = $1 and is_active returning id`,
          [productId, g.name, g.value ?? 0, g.imageUrl, g.conditions, g.endsAt],
        );
        if (!updated[0]) {
          await q.query("insert into public.free_gifts (product_id, name, value_kobo, image_url, conditions, ends_at) values ($1, $2, $3, $4, $5, $6)", [
            productId, g.name, g.value ?? 0, g.imageUrl, g.conditions, g.endsAt,
          ]);
        }
      }

      // Stock: only changed hubs go through adjust_inventory (audited, refuses going below reserved).
      for (const s of p.stock) {
        const cur = await q.query<{ onHand: number; threshold: number }>(
          `select on_hand as "onHand", low_stock_threshold as threshold from public.inventory where product_id = $1 and hub_id = $2`,
          [productId, s.hubId],
        );
        const c = cur[0];
        if (c && c.onHand === s.onHand && c.threshold === s.threshold) continue;
        if (!c && s.onHand === 0) continue;
        await q.query("select public.adjust_inventory($1, $2, $3, $4, $5)", [productId, s.hubId, s.onHand, s.threshold, c ? "adjust" : "restock"]);
      }
      return productId;
    });
  } catch (err) {
    const e = err as { code?: string; message?: string; constraint_name?: string; constraint?: string };
    if (e.code === "23505") {
      const which = `${e.constraint_name ?? e.constraint ?? e.message ?? ""}`;
      if (/sku/.test(which)) return { ok: false, error: "Another product already uses that SKU.", fieldErrors: { sku: "SKU already used" } };
      if (/popular/.test(which)) return { ok: false, error: "Only one bundle can be Most Popular." };
      return { ok: false, error: "Another product already uses that URL slug.", fieldErrors: { slug: "Slug already used" } };
    }
    const app = parseAppError(err);
    if (app?.appCode === "BELOW_RESERVED") return { ok: false, error: "Stock can't go below units already reserved for open orders." };
    if (app?.appCode === "FORBIDDEN") return { ok: false, error: "Only admins can edit products." };
    if (e.message === "PRODUCT_NOT_FOUND") return { ok: false, error: "That product no longer exists." };
    console.error("[catalog] save failed", err);
    return { ok: false, error: "Couldn't save the product. Please try again." };
  }
  await auditAdmin(session.userId, p.id ? "product.update" : "product.create", "product", id, { slug: p.slug, price_kobo: p.price, is_active: p.isActive });
  revalidateCatalog(p.slug);
  // Return the saved state (new bundle ids etc.) so the open editor continues from it without a reload.
  const fresh = await getProductForEdit(session, id);
  return { ok: true, id, slug: p.slug, message: p.id ? "Product saved." : "Product created.", values: fresh?.values, images: fresh?.images };
}

export type UploadResult = { ok: true; url: string; id?: string; alt?: string } | { ok: false; error: string };

async function readImage(formData: FormData): Promise<{ data: Buffer; type: string } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  const bad = validateImage(file);
  if (bad) return { error: bad };
  return { data: Buffer.from(await file.arrayBuffer()), type: file.type };
}

/** Uploads a product photo (public bucket) and appends it to the product's gallery. */
export async function uploadProductImageAction(formData: FormData): Promise<UploadResult> {
  const session = await requireRole(["admin"], "/admin/products");
  const productId = String(formData.get("productId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { ok: false, error: "Save the product first." };
  const alt = String(formData.get("alt") ?? "").trim().slice(0, 200);
  const img = await readImage(formData);
  if ("error" in img) return { ok: false, error: img.error };
  let url: string;
  try {
    url = (await uploadImage("product-images", `products/${productId}`, img.data, img.type)).ref;
  } catch {
    return { ok: false, error: "That file isn't a valid JPG, PNG or WebP image." };
  }
  const rows = await asUser(session.userId, (q) =>
    q.query<{ id: string }>(
      `insert into public.product_images (product_id, url, alt, sort_order)
       values ($1, $2, $3, coalesce((select max(sort_order) + 1 from public.product_images where product_id = $1), 0)) returning id`,
      [productId, url, alt],
    ),
  );
  // No revalidation here: it would re-render the open editor and drop unsaved edits. Saving the
  // product (which also stores the photo order/alt text) revalidates the storefront.
  return { ok: true, url, id: rows[0]!.id, alt };
}

/** Uploads a standalone image (gift photo, landing-page poster/OG image) and returns its public URL. */
export async function uploadCatalogImageAction(formData: FormData): Promise<UploadResult> {
  await requireRole(["admin"], "/admin");
  const img = await readImage(formData);
  if ("error" in img) return { ok: false, error: img.error };
  try {
    return { ok: true, url: (await uploadImage("product-images", "content", img.data, img.type)).ref };
  } catch {
    return { ok: false, error: "That file isn't a valid JPG, PNG or WebP image." };
  }
}
