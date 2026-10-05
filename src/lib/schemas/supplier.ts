import { z } from "zod";
import { normalizeNgPhone } from "../phone";
import { parseNairaInput } from "../money";

const links = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const out: string[] = [];
    for (const raw of (v ?? "").split(/[\s,]+/).filter(Boolean)) {
      try {
        const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
        out.push(u.toString());
      } catch {
        ctx.addIssue({ code: "custom", message: `"${raw.slice(0, 40)}" isn't a valid link.` });
        return z.NEVER;
      }
    }
    return out.slice(0, 5);
  });

/** Public "Become a supplier" application (also creates the applicant's login). */
export const supplierApplication = z.object({
  businessName: z.string().trim().min(2, "Enter your business name.").max(120),
  contactName: z.string().trim().min(2, "Enter your name.").max(80),
  phone: z.string().transform((v, ctx) => {
    const p = normalizeNgPhone(v);
    if (!p.ok) {
      ctx.addIssue({ code: "custom", message: p.error });
      return z.NEVER;
    }
    return p.e164;
  }),
  email: z.email("Enter a valid email address.").transform((v) => v.toLowerCase()),
  password: z.string().min(10, "Use at least 10 characters.").max(100),
  cacNumber: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^(RC|BN)\s?\d{4,8}$/i.test(v), "CAC numbers look like RC1234567 or BN1234567 — leave empty if it's in progress."),
  categories: z.array(z.string().max(60)).max(10).default([]),
  sampleLinks: links,
  message: z.string().trim().max(1000).optional().transform((v) => v || null),
  website: z.string().max(0, "Leave this empty.").optional(),
});

const naira = (label: string, optional = false) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (optional && !v?.trim()) return null;
      const k = parseNairaInput(v ?? "");
      if (k === null || k <= 0) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} in naira.` });
        return z.NEVER;
      }
      return k;
    });

/** Supplier product submission (draft or sent for review). */
export const supplierProduct = z
  .object({
    id: z.uuid().nullable().optional(),
    name: z.string().trim().min(3, "Name the product.").max(160),
    description: z.string().trim().min(20, "Describe it in at least 20 characters.").max(4000),
    categoryId: z.uuid().nullable().optional().transform((v) => v ?? null),
    proposedPrice: naira("your proposed selling price"),
    compareAt: naira("the compare-at price", true),
    stockAvailable: z.coerce.number().int().min(0).max(100_000),
    imageUrls: z.array(z.string().max(500)).max(6).default([]),
    submit: z.boolean().default(false),
  })
  .refine((p) => p.compareAt === null || p.compareAt! >= p.proposedPrice!, { path: ["compareAt"], message: "Compare-at must be at least the price." })
  .refine((p) => !p.submit || p.imageUrls.length > 0, { path: ["imageUrls"], message: "Add at least one photo before sending for review." });

export type SupplierApplicationInput = z.input<typeof supplierApplication>;
export type SupplierProductInput = z.input<typeof supplierProduct>;
