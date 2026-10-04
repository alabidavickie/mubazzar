import { z } from "zod";
import { parseNairaInput } from "../money";
import { SLUG_RE } from "../slug";
import { lagosLocalToUtc } from "../time";

/** Admin product editor payload. Money arrives as naira text and leaves as integer kobo. */

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const naira = (label: string) =>
  z.string().transform((v, ctx) => {
    const kobo = parseNairaInput(v);
    if (kobo === null || kobo <= 0) {
      ctx.addIssue({ code: "custom", message: `Enter ${label} in naira, e.g. 19,500.` });
      return z.NEVER;
    }
    return kobo;
  });

const optNaira = (label: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) return null;
      const kobo = parseNairaInput(v);
      if (kobo === null || kobo <= 0) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} in naira, e.g. 24,500 — or leave it empty.` });
        return z.NEVER;
      }
      return kobo;
    });

const lagosDateTime = z
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
  });

const icon = z
  .string()
  .trim()
  .max(40)
  .regex(/^[a-z0-9_-]*$/, "Icon names are Material Symbols names, e.g. check_circle.")
  .optional()
  .transform((v) => (v ? v : null));

/** Typed money in bundle tags drifts from real prices (the UI computes savings). */
const NO_AMOUNTS = /₦\s*\d|\bN\d{2,}/;

export const bundleInput = z
  .object({
    id: z.uuid().nullable().optional(),
    label: text(120).min(2, "Give the bundle a name."),
    shortLabel: optText(120),
    description: optText(240),
    quantity: z.coerce.number().int().min(1, "At least 1 unit.").max(50),
    price: naira("the bundle price"),
    compareAt: optNaira("the compare-at price"),
    promoPrice: optNaira("the promo price"),
    promoEndsAt: lagosDateTime,
    tag: optText(60).refine((v) => !v || !NO_AMOUNTS.test(v), "Labels only (e.g. MOST POPULAR) — savings are calculated automatically."),
    sideTag: optText(40),
    note: optText(160),
    isPopular: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .superRefine((b, ctx) => {
    if (b.compareAt !== null && b.compareAt < b.price) ctx.addIssue({ code: "custom", path: ["compareAt"], message: "Compare-at must be at least the price." });
    if (b.promoPrice !== null && b.promoPrice >= b.price) ctx.addIssue({ code: "custom", path: ["promoPrice"], message: "The promo price must be lower than the regular price." });
    if ((b.promoPrice === null) !== (b.promoEndsAt === null))
      ctx.addIssue({ code: "custom", path: ["promoEndsAt"], message: "A promo price needs a real end date (and vice versa)." });
  });

export const productInput = z
  .object({
    id: z.uuid().nullable().optional(),
    name: text(160).min(3, "Enter the product name."),
    slug: text(80).regex(SLUG_RE, "Use lowercase letters, numbers and dashes, e.g. turbo-car-vacuum."),
    shortDescription: optText(240),
    description: optText(8000),
    categoryId: z.uuid().nullable().optional().transform((v) => v ?? null),
    price: naira("the price"),
    compareAt: optNaira("the compare-at price"),
    sku: optText(60),
    tags: z
      .string()
      .optional()
      .transform((v) =>
        [...new Set((v ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20),
      ),
    imageBadge: optText(40),
    imageBadgeStyle: z.enum(["navy", "emerald", "gold", "bronze", "red"]).default("navy"),
    imageBadgeIcon: icon,
    perkText: optText(60),
    perkIcon: icon,
    perkStyle: z.enum(["gold", "neutral"]).default("gold"),
    deliveryNote: optText(60),
    deliveryNoteIcon: icon,
    podAvailable: z.boolean().default(true),
    warrantyMonths: z.coerce.number().int().min(0).max(120).default(0),
    isActive: z.boolean().default(true),
    curatedRank: z.coerce.number().int().min(1).max(999).nullable().optional().transform((v) => v ?? null),
    curatedLabel: optText(30),
    seoTitle: optText(70),
    seoDescription: optText(170),
    specs: z.array(z.object({ label: text(60).min(1), value: text(200).min(1) })).max(30).default([]),
    features: z
      .array(z.object({ icon: icon.transform((v) => v ?? "check_circle"), title: text(80).min(1, "Feature title required."), description: text(400).min(1, "Feature description required.") }))
      .max(12)
      .default([]),
    faqs: z.array(z.object({ question: text(200).min(1, "Question required."), answer: text(1500).min(1, "Answer required.") })).max(20).default([]),
    images: z.array(z.object({ id: z.uuid(), alt: text(200) })).max(12).default([]),
    bundles: z.array(bundleInput).max(6).default([]),
    gift: z
      .object({
        name: text(120).min(2, "Name the gift."),
        value: optNaira("the gift value"),
        imageUrl: optText(500),
        conditions: optText(240),
        endsAt: lagosDateTime,
      })
      .nullable()
      .default(null),
    stock: z
      .array(z.object({ hubId: z.uuid(), onHand: z.coerce.number().int().min(0).max(1_000_000), threshold: z.coerce.number().int().min(0).max(100_000) }))
      .default([]),
  })
  .superRefine((p, ctx) => {
    if (p.compareAt !== null && p.compareAt < p.price) ctx.addIssue({ code: "custom", path: ["compareAt"], message: "Compare-at must be at least the price." });
    if (p.bundles.filter((b) => b.isActive && b.isPopular).length > 1)
      ctx.addIssue({ code: "custom", path: ["bundles"], message: "Only one bundle can be marked Most Popular." });
  });

export type ProductInput = z.input<typeof productInput>;
export type ProductData = z.output<typeof productInput>;
