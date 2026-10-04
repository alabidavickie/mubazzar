import { z } from "zod";
import { MAX_CART_LINES, MAX_PACKS } from "../cart";

/** Server-cart sync payload: identity + pack counts only (prices are always re-read from the DB). */
export const cartSyncSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        bundleId: z.uuid().nullable(),
        packs: z.int().min(1).max(MAX_PACKS),
      }),
    )
    .max(MAX_CART_LINES),
  /** true on the first sync after sign-in: merge with the saved cart and return re-priced lines. */
  merge: z.boolean(),
});

export type CartSyncInput = z.infer<typeof cartSyncSchema>;
