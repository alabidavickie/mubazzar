"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asUser } from "@/server/db";
import { parseAppError } from "@/server/db/types-core";
import { requireRole, STAFF_ROLES } from "@/server/session";
import { uploadImage, validateImage } from "@/server/adapters/storage";
import { notifyCustomerOfStatus } from "@/server/services/order-notify";
import { addNoteSchema, assignSchema, paymentFlagSchema, recordPaymentSchema, setStatusSchema } from "@/lib/schemas/admin-orders";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const APP_ERRORS: Record<string, string> = {
  FORBIDDEN: "You don't have permission to do that.",
  ORDER_NOT_FOUND: "That order no longer exists.",
  INVALID_TRANSITION: "That status change isn't allowed from the order's current status.",
  USE_COMPLETE_DELIVERY: "Mark deliveries complete from the delivery form so the collection is recorded.",
  INVALID_AMOUNT: "Enter an amount greater than zero.",
  ORDER_CANCELLED: "This order is cancelled — reopen it before recording a payment.",
  NOT_A_DISPATCHER: "Choose an active dispatcher.",
  ORDER_NOT_CONFIRMED: "Confirm the order before assigning a dispatcher.",
  OUT_OF_STOCK: "Not enough stock to reopen this order.",
  INVALID_METHOD: "Choose how the money was collected.",
  ORDER_NOT_DISPATCHED: "This order is not out for delivery.",
  REASON_REQUIRED: "Say why the delivery failed.",
};

function fail(err: unknown): ActionResult {
  const app = parseAppError(err);
  if (app) return { ok: false, error: APP_ERRORS[app.appCode] ?? "Something went wrong. Please try again." };
  console.error("[admin-orders]", err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function invalid(e: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const i of e.issues) fieldErrors[i.path.join(".")] ??= i.message;
  return { ok: false, error: Object.values(fieldErrors)[0] ?? "Please check the form.", fieldErrors };
}

const refresh = (orderId: string) => {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
};

export async function setOrderStatusAction(input: z.input<typeof setStatusSchema>): Promise<ActionResult> {
  const session = await requireRole(STAFF_ROLES, "/admin/orders");
  const p = setStatusSchema.safeParse(input);
  if (!p.success) return invalid(p.error);
  try {
    await asUser(session.userId, (q) => q.query("select public.set_order_status($1, $2::public.order_status, $3)", [p.data.orderId, p.data.status, p.data.note]));
  } catch (err) {
    return fail(err);
  }
  await notifyCustomerOfStatus(p.data.orderId, p.data.status, p.data.note);
  refresh(p.data.orderId);
  return { ok: true, message: "Status updated." };
}

export async function addOrderNoteAction(input: z.input<typeof addNoteSchema>): Promise<ActionResult> {
  const session = await requireRole(STAFF_ROLES, "/admin/orders");
  const p = addNoteSchema.safeParse(input);
  if (!p.success) return invalid(p.error);
  try {
    await asUser(session.userId, (q) => q.query("select public.add_order_note($1, $2)", [p.data.orderId, p.data.note]));
  } catch (err) {
    return fail(err);
  }
  refresh(p.data.orderId);
  return { ok: true, message: "Note added." };
}

export async function setPaymentFlagAction(input: z.input<typeof paymentFlagSchema>): Promise<ActionResult> {
  const session = await requireRole(STAFF_ROLES, "/admin/orders");
  const p = paymentFlagSchema.safeParse(input);
  if (!p.success) return invalid(p.error);
  try {
    await asUser(session.userId, (q) => q.query("select public.set_payment_agreement($1, $2, $3)", [p.data.orderId, p.data.flag, p.data.note]));
  } catch (err) {
    return fail(err);
  }
  refresh(p.data.orderId);
  return { ok: true, message: p.data.flag === "pay_on_delivery" ? "Pay on delivery agreed." : "Payment flag updated." };
}

export async function assignDispatcherAction(input: z.input<typeof assignSchema>): Promise<ActionResult> {
  const session = await requireRole(STAFF_ROLES, "/admin/orders");
  const p = assignSchema.safeParse(input);
  if (!p.success) return invalid(p.error);
  let status: string | undefined;
  try {
    const rows = await asUser(session.userId, (q) =>
      q.query<{ r: { status: string } }>("select public.assign_dispatcher($1, $2, $3) as r", [p.data.orderId, p.data.dispatcherId, p.data.note]),
    );
    status = rows[0]?.r.status;
  } catch (err) {
    return fail(err);
  }
  if (status === "dispatched") await notifyCustomerOfStatus(p.data.orderId, "dispatched");
  refresh(p.data.orderId);
  revalidatePath("/dispatch");
  return { ok: true, message: "Dispatcher assigned." };
}

/** FormData: orderId, kind, amount (naira text), method, reference, note, verified ("on"), proof (optional image). */
export async function recordPaymentAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole(STAFF_ROLES, "/admin/orders");
  const p = recordPaymentSchema.safeParse({
    orderId: formData.get("orderId"),
    kind: formData.get("kind") || "payment",
    amount: String(formData.get("amount") ?? ""),
    method: formData.get("method"),
    reference: String(formData.get("reference") ?? ""),
    note: String(formData.get("note") ?? ""),
    verified: formData.get("verified") === "on",
  });
  if (!p.success) return invalid(p.error);

  let proofRef: string | null = null;
  const proof = formData.get("proof");
  if (proof instanceof File && proof.size > 0) {
    const bad = validateImage(proof);
    if (bad) return { ok: false, error: bad, fieldErrors: { proof: bad } };
    try {
      const stored = await uploadImage("private-proofs", `payments/${p.data.orderId}`, Buffer.from(await proof.arrayBuffer()), proof.type);
      proofRef = stored.ref;
    } catch {
      return { ok: false, error: "That file isn't a valid JPG, PNG or WebP image.", fieldErrors: { proof: "Invalid image." } };
    }
  }

  let result: { payment_status: string; is_overpaid: boolean; balance_kobo: number } | undefined;
  try {
    const rows = await asUser(session.userId, (q) =>
      q.query<{ r: { payment_status: string; is_overpaid: boolean; balance_kobo: number } }>(
        "select public.record_payment($1, $2, $3::public.payment_method, $4, $5, $6, $7::public.payment_kind) as r",
        [p.data.orderId, p.data.amount, p.data.method, p.data.reference, p.data.note, proofRef, p.data.kind],
      ),
    );
    result = rows[0]?.r;
  } catch (err) {
    return fail(err);
  }
  refresh(p.data.orderId);
  if (result?.is_overpaid) return { ok: true, message: "Payment recorded — the order is now OVERPAID. Arrange a refund for the difference." };
  return { ok: true, message: result?.payment_status === "paid" ? "Payment recorded — order fully paid." : "Payment recorded." };
}
