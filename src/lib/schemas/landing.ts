import { z } from "zod";
import { SLUG_RE } from "../slug";
import { lagosLocalToUtc } from "../time";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const optUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (v.startsWith("/") && !v.startsWith("//")) return v;
    try {
      const u = new URL(v);
      if (u.protocol !== "https:") throw new Error("https only");
      return u.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Use an https:// link (or an uploaded image)." });
      return z.NEVER;
    }
  });

const icon = z
  .string()
  .trim()
  .max(40)
  .regex(/^[a-z0-9_-]*$/, "Use a Material Symbols name, e.g. verified.")
  .optional()
  .transform((v) => (v ? v : null));

/** A typed "48% OFF" drifts from real prices — the page computes the discount from the database. */
const TYPED_PERCENT = /\d\s*%/;

export const landingInput = z.object({
  id: z.uuid().nullable().optional(),
  slug: z.string().trim().max(80).regex(SLUG_RE, "Use lowercase letters, numbers and dashes, e.g. car-vacuum."),
  productId: z.uuid("Choose the product this page sells."),
  isPublished: z.boolean().default(false),
  hookLabel: z.string().trim().min(1).max(30).default("PROMO ALERT"),
  hookBanner: optText(160).refine((v) => !v || !TYPED_PERCENT.test(v), "Don't type discount percentages — the real discount is shown from the prices."),
  trendBadge: optText(80),
  headline: z.string().trim().min(5, "Write a headline.").max(160),
  subheadline: optText(400),
  heroOverlayText: optText(80),
  heroOverlayIcon: icon,
  warrantyBadge: optText(40),
  regionsText: optText(80),
  campaignEndsAt: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) return null;
      const d = lagosLocalToUtc(v);
      if (!d) {
        ctx.addIssue({ code: "custom", message: "Pick a valid date and time." });
        return z.NEVER;
      }
      return d;
    }),
  featuresTitle: optText(120),
  featuresSubtitle: optText(240),
  videoUrl: optUrl,
  videoPosterUrl: optUrl,
  videoTitle: optText(80),
  videoSubtitle: optText(120),
  ctaLabel: z.string().trim().min(3).max(60).default("Place Order & Pay on WhatsApp"),
  seoTitle: optText(70),
  seoDescription: optText(170),
  ogImageUrl: optUrl,
  sections: z
    .array(
      z.object({
        kind: z.enum(["trust_matrix", "custom_text"]),
        title: optText(120),
        body: optText(4000),
        items: z.array(z.object({ icon: icon.transform((v) => v ?? "verified"), title: z.string().trim().min(1).max(80), body: z.string().trim().max(240) })).max(8).default([]),
        isVisible: z.boolean().default(true),
      }),
    )
    .max(10)
    .default([]),
});

export type LandingInput = z.input<typeof landingInput>;
export type LandingData = z.output<typeof landingInput>;
