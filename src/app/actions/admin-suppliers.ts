"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asService, asUser } from "@/server/db";
import { parseAppError } from "@/server/db/types-core";
import { requireRole } from "@/server/session";
import { notify } from "@/server/adapters/notify";
import { revalidateCatalog } from "@/server/services/admin-audit";
import { parseNairaInput } from "@/lib/money";

export type ReviewResult = { ok: true; message: string } | { ok: false; error: string };

const ERR: Record<string, string> = {
  FORBIDDEN: "Only admins can review suppliers.",
  SUPPLIER_NOT_FOUND: "That application no longer exists.",
  SUBMISSION_NOT_FOUND: "That submission no longer exists.",
  SUBMISSION_NOT_PENDING: "That submission was already reviewed.",
};
const fail = (err: unknown): ReviewResult => {
  const app = parseAppError(err);
  if (app) return { ok: false, error: ERR[app.appCode] ?? "Something went wrong." };
  console.error("[admin-suppliers]", err);
  return { ok: false, error: "Something went wrong." };
};

const decision = z.object({ id: z.uuid(), approve: z.boolean(), note: z.string().trim().max(500).optional().transform((v) => v || null) });

/** Approve (promotes the applicant to the supplier role) or reject an application. */
export async function reviewSupplierAction(input: z.input<typeof decision>): Promise<ReviewResult> {
  const session = await requireRole(["admin"], "/admin/suppliers");
  const p = decision.safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request." };
  try {
    await asUser(session.userId, (q) => q.query("select public.review_supplier($1, $2, $3)", [p.data.id, p.data.approve, p.data.note]));
  } catch (err) {
    return fail(err);
  }
  const [s] = await asService((q) => q.query<{ email: string; phone: string; name: string }>("select email, phone_e164 as phone, business_name as name from public.suppliers where id = $1", [p.data.id]));
  if (s) {
    await notify({
      channel: "email",
      to: s.email,
      template: p.data.approve ? "supplier_approved" : "supplier_rejected",
      subject: p.data.approve ? "You're approved to sell on MUBAZZAR" : "Your MUBAZZAR supplier application",
      body: p.data.approve
        ? `Welcome ${s.name}! Sign in at mubazzar.ng/login (Staff & partners) to submit your products.`
        : `Thank you for applying. We can't onboard ${s.name} right now.${p.data.note ? ` Note: ${p.data.note}` : ""}`,
    });
  }
  revalidatePath("/admin/suppliers");
  return { ok: true, message: p.data.approve ? "Supplier approved." : "Application rejected." };
}

const submission = decision.extend({ price: z.string().optional() });

/** Approve (creates a live product with the photos and warehouse stock) or reject a supplier's submission. */
export async function reviewSubmissionAction(input: z.input<typeof submission>): Promise<ReviewResult> {
  const session = await requireRole(["admin"], "/admin/suppliers");
  const p = submission.safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request." };
  const price = p.data.price?.trim() ? parseNairaInput(p.data.price) : null;
  if (p.data.price?.trim() && (price === null || price <= 0)) return { ok: false, error: "Enter the selling price in naira." };
  let slug: string | undefined;
  try {
    const rows = await asUser(session.userId, (q) =>
      q.query<{ r: { slug?: string } }>("select public.review_supplier_product($1, $2, $3, $4) as r", [p.data.id, p.data.approve, p.data.note, price]),
    );
    slug = rows[0]?.r.slug;
  } catch (err) {
    return fail(err);
  }
  if (p.data.approve) revalidateCatalog(slug);
  revalidatePath("/admin/suppliers");
  revalidatePath("/supplier");
  return { ok: true, message: p.data.approve ? `Approved — live at /p/${slug}` : "Submission rejected." };
}
