"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asUser } from "@/server/db";
import { parseAppError } from "@/server/db/types-core";
import { getSession } from "@/server/session";
import { listAddresses, type Address } from "@/server/services/account";
import { normalizeNgPhone } from "@/lib/phone";

export type AccountResult = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function customer() {
  const s = await getSession();
  return s && s.role === "customer" ? s : null;
}

const addressSchema = z.object({
  id: z.uuid().nullable().optional(),
  label: z.string().trim().min(1).max(30).default("Home"),
  fullName: z.string().trim().min(2, "Enter the recipient's name.").max(80),
  phone: z.string().transform((v, ctx) => {
    const p = normalizeNgPhone(v);
    if (!p.ok) {
      ctx.addIssue({ code: "custom", message: p.error });
      return z.NEVER;
    }
    return p.e164;
  }),
  state: z.string().trim().min(2, "Choose a state.").max(40),
  city: z.string().trim().min(2, "Enter the LGA / city.").max(80),
  address: z.string().trim().min(5, "Enter the street address.").max(240),
  landmark: z.string().trim().max(120).optional().transform((v) => v || null),
  isDefault: z.boolean().default(false),
});

export async function saveAddressAction(input: z.input<typeof addressSchema>): Promise<AccountResult> {
  const s = await customer();
  if (!s) return { ok: false, error: "Please sign in again." };
  const p = addressSchema.safeParse(input);
  if (!p.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of p.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { ok: false, error: Object.values(fieldErrors)[0]!, fieldErrors };
  }
  const a = p.data;
  const tooMany = await asUser(s.userId, async (q) => {
    const count = await q.query<{ n: number }>("select count(*)::int as n from public.customer_addresses where user_id = $1", [s.userId]);
    const makeDefault = a.isDefault || (count[0]?.n ?? 0) === 0;
    if (makeDefault) await q.query("update public.customer_addresses set is_default = false where user_id = $1", [s.userId]);
    const vals = [a.label, a.fullName, a.phone, a.state, a.city, a.address, a.landmark, makeDefault] as const;
    if (a.id) {
      await q.query(
        `update public.customer_addresses set label = $1, full_name = $2, phone_e164 = $3, state = $4, city = $5, address = $6, landmark = $7,
                is_default = $8 or is_default where id = $9 and user_id = $10`,
        [...vals, a.id, s.userId],
      );
    } else if ((count[0]?.n ?? 0) >= 10) {
      throw new Error("TOO_MANY");
    } else {
      await q.query(
        `insert into public.customer_addresses (label, full_name, phone_e164, state, city, address, landmark, is_default, user_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [...vals, s.userId],
      );
    }
  }).then(
    () => null,
    (err) => {
      if ((err as Error).message === "TOO_MANY") return "You can save up to 10 addresses — remove one first.";
      throw err;
    },
  );
  if (tooMany) return { ok: false, error: tooMany };
  revalidatePath("/account/addresses");
  return { ok: true, message: "Address saved." };
}

export async function deleteAddressAction(input: { id: string }): Promise<AccountResult> {
  const s = await customer();
  if (!s || !z.uuid().safeParse(input.id).success) return { ok: false, error: "Please sign in again." };
  await asUser(s.userId, (q) => q.query("delete from public.customer_addresses where id = $1 and user_id = $2", [input.id, s.userId]));
  revalidatePath("/account/addresses");
  return { ok: true, message: "Address removed." };
}

/** Default saved address for prefilling the order form (null for guests/no address). */
export async function getDefaultAddressAction(): Promise<Address | null> {
  const s = await customer();
  if (!s) return null;
  return (await listAddresses(s))[0] ?? null;
}

export async function toggleWishlistAction(input: { productId: string; on: boolean }): Promise<AccountResult & { signedIn?: boolean }> {
  const s = await customer();
  if (!s) return { ok: false, error: "Sign in to save items.", signedIn: false };
  if (!z.uuid().safeParse(input.productId).success) return { ok: false, error: "Invalid product." };
  await asUser(s.userId, (q) =>
    input.on
      ? q.query("insert into public.wishlists (user_id, product_id) values ($1, $2) on conflict do nothing", [s.userId, input.productId])
      : q.query("delete from public.wishlists where user_id = $1 and product_id = $2", [s.userId, input.productId]),
  );
  revalidatePath("/account/wishlist");
  return { ok: true, message: input.on ? "Saved to your wishlist." : "Removed from your wishlist." };
}

export async function isWishlistedAction(input: { productId: string }): Promise<boolean> {
  const s = await customer();
  if (!s || !z.uuid().safeParse(input.productId).success) return false;
  const rows = await asUser(s.userId, (q) => q.query("select 1 from public.wishlists where user_id = $1 and product_id = $2", [s.userId, input.productId]));
  return rows.length > 0;
}

const reviewSchema = z.object({
  orderId: z.uuid(),
  productId: z.uuid(),
  rating: z.coerce.number().int().min(1, "Choose a star rating.").max(5),
  body: z.string().trim().min(10, "Write at least 10 characters.").max(1500),
  location: z.string().trim().max(60).optional().transform((v) => v || null),
});

/** Verified-purchase review (submit_review checks the order was delivered to this customer). */
export async function submitReviewAction(input: z.input<typeof reviewSchema>): Promise<AccountResult> {
  const s = await customer();
  if (!s) return { ok: false, error: "Please sign in again." };
  const p = reviewSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]!.message };
  try {
    await asUser(s.userId, (q) =>
      q.query("select public.submit_review($1, $2, $3, $4, $5)", [p.data.orderId, p.data.productId, p.data.rating, p.data.body, p.data.location]),
    );
  } catch (err) {
    const app = parseAppError(err);
    if (app?.appCode === "NOT_A_VERIFIED_PURCHASE") return { ok: false, error: "You can review products from delivered orders only." };
    if (app?.appCode === "INVALID_REVIEW") return { ok: false, error: "Choose 1–5 stars and write at least 10 characters." };
    if ((err as { code?: string }).code === "23505") return { ok: false, error: "You've already reviewed this product for this order." };
    console.error("[review]", err);
    return { ok: false, error: "Couldn't send your review. Please try again." };
  }
  revalidatePath("/account");
  return { ok: true, message: "Thank you! Your review will appear after a quick check." };
}
