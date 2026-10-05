import { z } from "zod";
import { parseNairaInput } from "../money";
import { lagosLocalToUtc } from "../time";

const when = (label: string) =>
  z.string().transform((v, ctx) => {
    const d = lagosLocalToUtc(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: `Pick the ${label} date and time.` });
      return z.NEVER;
    }
    return d;
  });

/** A flash deal must change the real price for a real window (honesty rule). */
export const flashDealInput = z
  .object({
    id: z.uuid().nullable().optional(),
    productId: z.uuid("Choose a product."),
    title: z.string().trim().max(80).optional().transform((v) => v || null),
    promoText: z.string().trim().max(80).optional().transform((v) => v || null),
    dealPrice: z.string().transform((v, ctx) => {
      const k = parseNairaInput(v);
      if (k === null || k <= 0) {
        ctx.addIssue({ code: "custom", message: "Enter the deal price in naira." });
        return z.NEVER;
      }
      return k;
    }),
    startsAt: when("start"),
    endsAt: when("end"),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.endsAt > d.startsAt, { path: ["endsAt"], message: "The deal must end after it starts." });

export type FlashDealInput = z.input<typeof flashDealInput>;
