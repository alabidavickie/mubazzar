import { z } from "zod";
import { normalizeNgPhone } from "../phone";
import { parseCutoff } from "../time";

/** Server-side validation for every admin-editable `settings` row (key → schema). */

const str = (max: number, min = 0) => z.string().trim().min(min).max(max);
const icon = z.string().trim().regex(/^[a-z0-9_-]{1,40}$/, "Use a Material Symbols name, e.g. verified_user.");
const phone = z.string().transform((v, ctx) => {
  const p = normalizeNgPhone(v);
  if (!p.ok) {
    ctx.addIssue({ code: "custom", message: p.error });
    return z.NEVER;
  }
  return p.e164;
});
/** "a, b\nc" → ["a","b","c"] (admin lists typed in one box). */
const list = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (typeof v === "string" ? v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) : v), z.array(item).max(10));

export const SETTING_SCHEMAS = {
  promo_strip: str(200, 3),
  hero: z.object({
    badge: str(40),
    badgeNote: str(40),
    headline: str(120, 3),
    highlight: str(60),
    subtext: str(300),
    ctaLabel: str(40, 2),
    ctaHref: z.string().trim().regex(/^\/[a-z0-9/_?=&-]*$/i, "Use a site path such as /deals."),
    imageUrl: z.string().trim().max(500).nullable().optional().transform((v) => v || null),
  }),
  trust_bar: z.array(z.object({ icon, text: str(60, 2), tone: z.enum(["emerald", "gold"]) })).max(6),
  flash_section: z.object({ title: str(60, 2), subtitle: str(120) }),
  show_sample_reviews: z.boolean(),
  same_day_cutoff: z.string().refine((v) => parseCutoff(v) !== null, "Use 24h time like 14:00."),
  support: z.object({ whatsapp: phone, phone, hours: str(80), email: z.email() }),
  business: z.object({
    legalName: str(120, 2),
    address: str(240, 5),
    cac: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => v || null)
      .refine((v) => v === null || /^(RC|BN)\s?\d{4,8}$/i.test(v), "Only a real CAC number (RC… or BN… followed by digits)."),
    returnsDays: z.coerce.number().int().min(0).max(60),
  }),
  bank_accounts: z
    .array(z.object({ bank: str(60, 2), accountName: str(80, 2), accountNumber: z.string().trim().regex(/^\d{10}$/, "NUBAN account numbers have 10 digits.") }))
    .max(5),
  whatsapp_routing: z.enum(["by_hub", "round_robin", "first"]),
  chat_templates: z.object({
    customer_order: str(1000).optional(),
    staff_greeting: str(1000).optional(),
    staff_confirmation: str(1000).optional(),
    dispatch_contact: str(1000).optional(),
  }).transform((t) => Object.fromEntries(Object.entries(t).filter(([, v]) => v))),
  auto_cancel_hours: z.coerce.number().int().min(6, "At least 6 hours.").max(720),
  follow_up_after_hours: z.coerce.number().int().min(1).max(240),
  admin_alerts: z.object({ emails: list(z.email()), phones: list(phone) }),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;

export function isSettingKey(k: string): k is SettingKey {
  return Object.hasOwn(SETTING_SCHEMAS, k);
}
