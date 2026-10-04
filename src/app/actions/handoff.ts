"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { claimPayment } from "@/server/services/orders";
import { rateLimit } from "@/server/adapters/rate-limit";

const tokenSchema = z.string().regex(/^[0-9a-f]{32}$/);

export type ClaimPaymentResult = { ok: true; claimed: boolean } | { ok: false; error: string };

/**
 * Customer's "I've sent my payment" on the thank-you page. Only flags the order as
 * `payment_claimed` for staff to verify against the bank — it never marks anything as paid.
 */
export async function claimPaymentAction(token: string): Promise<ClaimPaymentResult> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "We couldn't find this order." };
  const limited = await rateLimit(`claim:${parsed.data}`, 5, 600);
  if (!limited.ok) return { ok: false, error: "Please wait a few minutes and try again." };
  const claimed = await claimPayment(parsed.data);
  revalidatePath(`/order/${parsed.data}`);
  return { ok: true, claimed };
}
