"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asUser } from "@/server/db";
import { parseAppError } from "@/server/db/types-core";
import { requireRole } from "@/server/session";
import { uploadImage, validateImage } from "@/server/adapters/storage";
import { notifyCustomerOfStatus } from "@/server/services/order-notify";
import { parseNairaInput } from "@/lib/money";

export type DispatchResult = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const ERRORS: Record<string, string> = {
  FORBIDDEN: "This delivery isn't assigned to you any more.",
  ORDER_NOT_FOUND: "That order no longer exists.",
  ORDER_NOT_DISPATCHED: "This order isn't out for delivery.",
  INVALID_METHOD: "Choose how you collected the money.",
  INVALID_AMOUNT: "Enter a valid amount.",
  REASON_REQUIRED: "Say why the delivery failed.",
};

function fail(err: unknown): DispatchResult {
  const app = parseAppError(err);
  if (app) return { ok: false, error: ERRORS[app.appCode] ?? "Something went wrong. Please try again." };
  console.error("[dispatch]", err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

async function storeProof(formData: FormData, orderId: string): Promise<{ ref: string | null } | { error: string }> {
  const proof = formData.get("proof");
  if (!(proof instanceof File) || proof.size === 0) return { ref: null };
  const bad = validateImage(proof);
  if (bad) return { error: bad };
  try {
    return { ref: (await uploadImage("private-proofs", `deliveries/${orderId}`, Buffer.from(await proof.arrayBuffer()), proof.type)).ref };
  } catch {
    return { error: "That photo isn't a valid JPG, PNG or WebP image." };
  }
}

const completeSchema = z.object({
  orderId: z.uuid(),
  collected: z.string().trim().default(""),
  method: z.enum(["pay_on_delivery", "pos_on_delivery", "bank_transfer"]).nullable(),
  note: z.string().trim().max(500).default(""),
});

/** Rider marks an assigned order delivered, recording cash/POS collected at the door (if any) + proof photo. */
export async function completeDeliveryAction(formData: FormData): Promise<DispatchResult> {
  const session = await requireRole(["dispatcher"], "/dispatch");
  const p = completeSchema.safeParse({
    orderId: formData.get("orderId"),
    collected: String(formData.get("collected") ?? ""),
    method: formData.get("method") || null,
    note: String(formData.get("note") ?? ""),
  });
  if (!p.success) return { ok: false, error: "Please check the form." };
  const collected = p.data.collected ? parseNairaInput(p.data.collected) : 0;
  if (collected === null) return { ok: false, error: "Enter the amount in naira, e.g. 37,500.", fieldErrors: { collected: "Invalid amount" } };
  if (collected > 0 && !p.data.method) return { ok: false, error: ERRORS.INVALID_METHOD!, fieldErrors: { method: "Required" } };
  const proof = await storeProof(formData, p.data.orderId);
  if ("error" in proof) return { ok: false, error: proof.error, fieldErrors: { proof: proof.error } };
  try {
    await asUser(session.userId, (q) =>
      q.query("select public.complete_delivery($1, $2, $3::public.payment_method, $4, $5)", [
        p.data.orderId,
        collected,
        collected > 0 ? p.data.method : null,
        proof.ref,
        p.data.note || null,
      ]),
    );
  } catch (err) {
    return fail(err);
  }
  await notifyCustomerOfStatus(p.data.orderId, "delivered");
  revalidatePath("/dispatch");
  revalidatePath(`/admin/orders/${p.data.orderId}`);
  return { ok: true, message: "Marked delivered. Thank you!" };
}

const failSchema = z.object({ orderId: z.uuid(), reason: z.string().trim().min(3, "Say why the delivery failed.").max(500) });

export async function failDeliveryAction(formData: FormData): Promise<DispatchResult> {
  const session = await requireRole(["dispatcher"], "/dispatch");
  const p = failSchema.safeParse({ orderId: formData.get("orderId"), reason: String(formData.get("reason") ?? "") });
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Please check the form.", fieldErrors: { reason: "Required" } };
  const proof = await storeProof(formData, p.data.orderId);
  if ("error" in proof) return { ok: false, error: proof.error, fieldErrors: { proof: proof.error } };
  try {
    await asUser(session.userId, (q) => q.query("select public.fail_delivery($1, $2, $3)", [p.data.orderId, p.data.reason, proof.ref]));
  } catch (err) {
    return fail(err);
  }
  await notifyCustomerOfStatus(p.data.orderId, "failed_delivery", p.data.reason);
  revalidatePath("/dispatch");
  revalidatePath(`/admin/orders/${p.data.orderId}`);
  return { ok: true, message: "Marked as failed. The office has been updated." };
}
