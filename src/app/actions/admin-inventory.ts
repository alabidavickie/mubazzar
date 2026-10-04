"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asUser } from "@/server/db";
import { parseAppError } from "@/server/db/types-core";
import { requireRole } from "@/server/session";

const schema = z.object({
  productId: z.uuid(),
  hubId: z.uuid(),
  onHand: z.coerce.number().int("Whole units only.").min(0).max(1_000_000),
  threshold: z.coerce.number().int().min(0).max(100_000),
  reason: z.enum(["restock", "adjust", "count"]).default("adjust"),
});

export type InventoryResult = { ok: true; message: string } | { ok: false; error: string };

/** Admin sets on-hand units (restock or stock count) and the low-stock threshold for a hub. */
export async function adjustInventoryAction(input: z.input<typeof schema>): Promise<InventoryResult> {
  const session = await requireRole(["admin"], "/admin/inventory");
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the numbers." };
  try {
    await asUser(session.userId, (q) =>
      q.query("select public.adjust_inventory($1, $2, $3, $4, $5)", [p.data.productId, p.data.hubId, p.data.onHand, p.data.threshold, p.data.reason]),
    );
  } catch (err) {
    const app = parseAppError(err);
    if (app?.appCode === "BELOW_RESERVED") return { ok: false, error: "On-hand can't go below units already reserved for open orders." };
    if (app?.appCode === "FORBIDDEN") return { ok: false, error: "Only admins can change stock." };
    console.error("[inventory]", err);
    return { ok: false, error: "Couldn't save. Please try again." };
  }
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { ok: true, message: "Stock saved." };
}
