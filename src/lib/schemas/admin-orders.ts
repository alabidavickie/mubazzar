import { z } from "zod";
import { ORDER_STATUSES, PAYMENT_METHODS } from "../admin-orders";
import { parseNairaInput } from "../money";

const orderId = z.uuid();
const note = z.string().trim().max(1000).optional().transform((v) => (v ? v : null));

export const setStatusSchema = z.object({ orderId, status: z.enum(ORDER_STATUSES), note });
export const addNoteSchema = z.object({ orderId, note: z.string().trim().min(1, "Write a note first.").max(2000) });
export const paymentFlagSchema = z.object({ orderId, flag: z.enum(["payment_claimed", "pay_on_delivery", "unpaid"]), note });
export const assignSchema = z.object({ orderId, dispatcherId: z.uuid("Choose a dispatcher."), note });

/** Naira text ("19,500" / "₦19500.50") → kobo; positive only. */
export const nairaAmount = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const kobo = parseNairaInput(v);
    if (kobo === null || kobo <= 0) {
      ctx.addIssue({ code: "custom", message: "Enter the amount in naira, e.g. 19,500." });
      return z.NEVER;
    }
    return kobo;
  });

export const recordPaymentSchema = z
  .object({
    orderId,
    kind: z.enum(["payment", "refund"]).default("payment"),
    amount: nairaAmount,
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().max(200).optional().transform((v) => (v ? v : null)),
    note,
    /** Staff tick this after checking the bank app — screenshots alone are not proof. */
    verified: z.boolean(),
  })
  .refine((v) => v.kind === "refund" || v.method !== "bank_transfer" || v.verified, {
    path: ["verified"],
    message: "Confirm the money has arrived in our bank account (not just a screenshot).",
  });
