"use server";

import { revalidatePath } from "next/cache";
import { asUser } from "@/server/db";
import { requireRole } from "@/server/session";
import { auditAdmin, revalidateCatalog } from "@/server/services/admin-audit";
import { flashDealInput, type FlashDealInput } from "@/lib/schemas/flash-deal";

export type FlashDealResult = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function saveFlashDealAction(input: FlashDealInput): Promise<FlashDealResult> {
  const session = await requireRole(["admin"], "/admin/flash-deals");
  const p = flashDealInput.safeParse(input);
  if (!p.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of p.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { ok: false, error: Object.values(fieldErrors)[0] ?? "Please check the form.", fieldErrors };
  }
  const d = p.data;
  const res = await asUser(session.userId, async (q) => {
    const [prod] = await q.query<{ price: number }>("select price_kobo::bigint as price from public.products where id = $1", [d.productId]);
    if (!prod) return { error: "That product no longer exists." };
    if (d.dealPrice >= Number(prod.price)) return { error: "The deal price must be lower than the product's regular price." };
    if (d.id) {
      const rows = await q.query(
        `update public.flash_deals set product_id = $2, title = $3, promo_text = $4, deal_price_kobo = $5, starts_at = $6, ends_at = $7, is_active = $8
          where id = $1 returning id`,
        [d.id, d.productId, d.title, d.promoText, d.dealPrice, d.startsAt, d.endsAt, d.isActive],
      );
      if (!rows[0]) return { error: "That deal no longer exists." };
      return { id: d.id };
    }
    const rows = await q.query<{ id: string }>(
      `insert into public.flash_deals (product_id, title, promo_text, deal_price_kobo, starts_at, ends_at, is_active)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [d.productId, d.title, d.promoText, d.dealPrice, d.startsAt, d.endsAt, d.isActive],
    );
    return { id: rows[0]!.id };
  });
  if ("error" in res) return { ok: false, error: res.error!, fieldErrors: { dealPrice: res.error! } };
  await auditAdmin(session.userId, d.id ? "flash_deal.update" : "flash_deal.create", "flash_deal", res.id, {
    product_id: d.productId,
    deal_price_kobo: d.dealPrice,
    starts_at: d.startsAt,
    ends_at: d.endsAt,
    is_active: d.isActive,
  });
  revalidateCatalog();
  revalidatePath("/admin/flash-deals");
  return { ok: true, message: d.id ? "Deal saved." : "Deal created." };
}
