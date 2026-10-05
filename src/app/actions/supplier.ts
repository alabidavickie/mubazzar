"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asService, asUser } from "@/server/db";
import { requireRole } from "@/server/session";
import { createUser } from "@/server/adapters/auth";
import { hashIp, rateLimit } from "@/server/adapters/rate-limit";
import { notify } from "@/server/adapters/notify";
import { uploadImage, validateImage } from "@/server/adapters/storage";
import { getPrivateSetting } from "@/server/services/settings";
import { supplierApplication, supplierProduct, type SupplierApplicationInput, type SupplierProductInput } from "@/lib/schemas/supplier";

export type SupplierResult = { ok: true; message: string; id?: string; url?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function invalid(issues: { path: PropertyKey[]; message: string }[]): SupplierResult {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues) fieldErrors[i.path.map(String).join(".")] ??= i.message;
  return { ok: false, error: Object.values(fieldErrors)[0] ?? "Please check the form.", fieldErrors };
}

async function clientIp() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** Public application: rate-limited, honeypot, creates the applicant's login (role stays customer until approved). */
export async function applySupplierAction(input: SupplierApplicationInput): Promise<SupplierResult> {
  const p = supplierApplication.safeParse(input);
  if (!p.success) {
    if (p.error.issues.some((i) => i.path[0] === "website")) return { ok: false, error: "We couldn't send your application. Please try again." };
    return invalid(p.error.issues);
  }
  const a = p.data;
  const ip = hashIp(await clientIp());
  const [byIp, byEmail] = await Promise.all([rateLimit(`supplier:ip:${ip}`, 5, 3600), rateLimit(`supplier:email:${a.email}`, 3, 86_400)]);
  if (!byIp.ok || !byEmail.ok) return { ok: false, error: "Too many applications from here. Please try again later or message us on WhatsApp." };

  const existing = await asService((q) => q.query("select 1 from public.suppliers where lower(email) = $1", [a.email]));
  if (existing.length) return { ok: false, error: "We already have an application for this email. Sign in to check its status.", fieldErrors: { email: "Already applied" } };
  const user = await createUser({ email: a.email, phone: a.phone, password: a.password, fullName: a.contactName });
  if (!user.ok) return { ok: false, error: "An account with this email or phone already exists — sign in first, then apply.", fieldErrors: { email: user.error } };

  const rows = await asService((q) =>
    q.query<{ id: string }>(
      `insert into public.suppliers (user_id, business_name, contact_name, phone_e164, email, cac_number, categories, sample_links, message)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [user.userId, a.businessName, a.contactName, a.phone, a.email, a.cacNumber, a.categories, a.sampleLinks, a.message],
    ),
  );
  const alerts = await getPrivateSetting<{ emails?: string[] }>("admin_alerts", {});
  await Promise.all(
    (alerts.emails ?? []).map((to) =>
      notify({ channel: "email", to, template: "admin_supplier_application", subject: `New supplier application: ${a.businessName}`, body: `${a.businessName} (${a.contactName}, ${a.phone}) applied to sell on MUBAZZAR. Review it in Admin → Suppliers.` }),
    ),
  );
  revalidatePath("/admin/suppliers");
  return { ok: true, id: rows[0]!.id, message: "Application received! We review applications within 2 working days. Sign in any time to check the status." };
}

async function mySupplier(userId: string): Promise<{ id: string; status: string } | null> {
  const rows = await asUser(userId, (q) => q.query<{ id: string; status: string }>("select id, status from public.suppliers where user_id = $1", [userId]));
  return rows[0] ?? null;
}

/** Create/update a draft, or send it for review (RLS: approved suppliers, draft/pending only). */
export async function saveSupplierProductAction(input: SupplierProductInput): Promise<SupplierResult> {
  const session = await requireRole(["supplier"], "/supplier");
  const p = supplierProduct.safeParse(input);
  if (!p.success) return invalid(p.error.issues);
  const s = await mySupplier(session.userId);
  if (!s || s.status !== "approved") return { ok: false, error: "Your supplier account isn't approved yet." };
  const d = p.data;
  const status = d.submit ? "pending" : "draft";
  try {
    const id = await asUser(session.userId, async (q) => {
      const vals = [d.name, d.description, d.categoryId, d.proposedPrice, d.compareAt, d.imageUrls, d.stockAvailable, status] as const;
      if (d.id) {
        const rows = await q.query<{ id: string }>(
          `update public.supplier_products set name = $1, description = $2, category_id = $3, proposed_price_kobo = $4, compare_at_kobo = $5,
                  image_urls = $6, stock_available = $7, status = $8::public.submission_status, review_note = null
            where id = $9 returning id`,
          [...vals, d.id],
        );
        if (!rows[0]) throw new Error("LOCKED");
        return rows[0].id;
      }
      const rows = await q.query<{ id: string }>(
        `insert into public.supplier_products (name, description, category_id, proposed_price_kobo, compare_at_kobo, image_urls, stock_available, status, supplier_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8::public.submission_status, $9) returning id`,
        [...vals, s.id],
      );
      return rows[0]!.id;
    });
    revalidatePath("/supplier");
    revalidatePath("/admin/suppliers");
    return { ok: true, id, message: d.submit ? "Sent for review. We'll notify you when it's approved." : "Draft saved." };
  } catch (err) {
    if ((err as Error).message === "LOCKED") return { ok: false, error: "This product was already reviewed and can't be edited." };
    console.error("[supplier] save failed", err);
    return { ok: false, error: "Couldn't save. Please try again." };
  }
}

export async function deleteSupplierDraftAction(input: { id: string }): Promise<SupplierResult> {
  const session = await requireRole(["supplier"], "/supplier");
  if (!z.uuid().safeParse(input.id).success) return { ok: false, error: "Invalid request." };
  const rows = await asUser(session.userId, (q) => q.query("delete from public.supplier_products where id = $1 and status = 'draft' returning id", [input.id]));
  revalidatePath("/supplier");
  return rows.length ? { ok: true, message: "Draft deleted." } : { ok: false, error: "Only drafts can be deleted." };
}

export async function uploadSupplierImageAction(formData: FormData): Promise<SupplierResult> {
  const session = await requireRole(["supplier"], "/supplier");
  const s = await mySupplier(session.userId);
  if (!s || s.status !== "approved") return { ok: false, error: "Your supplier account isn't approved yet." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo." };
  const bad = validateImage(file);
  if (bad) return { ok: false, error: bad };
  if (!(await rateLimit(`supplier-upload:${s.id}`, 60, 3600)).ok) return { ok: false, error: "Too many uploads — try again later." };
  try {
    const stored = await uploadImage("product-images", `suppliers/${s.id}`, Buffer.from(await file.arrayBuffer()), file.type);
    return { ok: true, url: stored.ref, message: "Photo uploaded." };
  } catch {
    return { ok: false, error: "That file isn't a valid JPG, PNG or WebP image." };
  }
}
