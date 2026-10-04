"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asUser } from "@/server/db";
import { requireRole } from "@/server/session";
import { createUser } from "@/server/adapters/auth";
import { auditAdmin, revalidateCatalog } from "@/server/services/admin-audit";
import { SETTING_SCHEMAS, isSettingKey } from "@/lib/schemas/settings";
import { normalizeNgPhone } from "@/lib/phone";
import { parseNairaInput } from "@/lib/money";
import { slugify, SLUG_RE } from "@/lib/slug";

export type SettingsResult = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function invalid(issues: { path: PropertyKey[]; message: string }[]): SettingsResult {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues) fieldErrors[i.path.map(String).join(".")] ??= i.message;
  return { ok: false, error: Object.values(fieldErrors)[0] ?? "Please check the form.", fieldErrors };
}

const pgError = (err: unknown, fallback: string): SettingsResult => {
  const e = err as { code?: string };
  if (e.code === "23505") return { ok: false, error: "That value is already used by another record." };
  if (e.code === "23503") return { ok: false, error: "That record is still in use." };
  console.error("[admin-settings]", err);
  return { ok: false, error: fallback };
};

/** Saves one settings row after validating it with its own schema. */
export async function saveSettingAction(input: { key: string; value: unknown }): Promise<SettingsResult> {
  const session = await requireRole(["admin"], "/admin");
  if (!isSettingKey(input.key)) return { ok: false, error: "Unknown setting." };
  const parsed = SETTING_SCHEMAS[input.key].safeParse(input.value);
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const rows = await asUser(session.userId, (q) =>
      q.query("update public.settings set value = $2::jsonb, updated_by = $3, updated_at = now() where key = $1 returning key", [
        input.key,
        JSON.stringify(parsed.data),
        session.userId,
      ]),
    );
    if (!rows[0]) return { ok: false, error: "Setting not found." };
  } catch (err) {
    return pgError(err, "Couldn't save the setting.");
  }
  await auditAdmin(session.userId, "settings.update", "setting", input.key, { value: input.key === "bank_accounts" ? "(bank details)" : parsed.data });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

const channelSchema = z.object({
  id: z.uuid().nullable().optional(),
  kind: z.enum(["whatsapp", "instagram", "messenger", "telegram", "phone"]),
  label: z.string().trim().min(2).max(60),
  handle: z.string().trim().min(2).max(80),
  hubCode: z.string().trim().max(20).nullable().optional().transform((v) => v || null),
  weight: z.coerce.number().int().min(1).max(100).default(1),
  isEnabled: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

/** Chat channels: WhatsApp numbers (per hub / round robin) and social handles. */
export async function saveChannelAction(input: z.input<typeof channelSchema>): Promise<SettingsResult> {
  const session = await requireRole(["admin"], "/admin/chat-payments");
  const p = channelSchema.safeParse(input);
  if (!p.success) return invalid(p.error.issues);
  const c = p.data;
  let handle = c.handle.replace(/^@/, "");
  if (c.kind === "whatsapp" || c.kind === "phone") {
    const ph = normalizeNgPhone(handle);
    if (!ph.ok) return { ok: false, error: ph.error, fieldErrors: { handle: ph.error } };
    handle = ph.e164;
  } else if (!/^[A-Za-z0-9._-]{2,60}$/.test(handle)) {
    return { ok: false, error: "Enter just the username/page name, e.g. mubazzar.ng", fieldErrors: { handle: "Invalid handle" } };
  }
  try {
    await asUser(session.userId, (q) =>
      c.id
        ? q.query(
            "update public.chat_channels set kind = $2, label = $3, handle = $4, hub_code = $5, weight = $6, is_enabled = $7, sort_order = $8 where id = $1",
            [c.id, c.kind, c.label, handle, c.hubCode, c.weight, c.isEnabled, c.sortOrder],
          )
        : q.query(
            "insert into public.chat_channels (kind, label, handle, hub_code, weight, is_enabled, sort_order) values ($1, $2, $3, $4, $5, $6, $7)",
            [c.kind, c.label, handle, c.hubCode, c.weight, c.isEnabled, c.sortOrder],
          ),
    );
  } catch (err) {
    return pgError(err, "Couldn't save the channel.");
  }
  await auditAdmin(session.userId, c.id ? "chat_channel.update" : "chat_channel.create", "chat_channel", c.id ?? null, { kind: c.kind, handle, enabled: c.isEnabled });
  revalidatePath("/", "layout");
  return { ok: true, message: "Channel saved." };
}

const zoneSchema = z.object({
  state: z.string().trim().min(2).max(40),
  fee: z.string().transform((v, ctx) => {
    const k = parseNairaInput(v);
    if (k === null) {
      ctx.addIssue({ code: "custom", message: "Enter the fee in naira (0 for free)." });
      return z.NEVER;
    }
    return k;
  }),
  etaMinDays: z.coerce.number().int().min(0).max(30),
  etaMaxDays: z.coerce.number().int().min(0).max(30),
  sameDayEnabled: z.boolean(),
  hubCode: z.string().trim().min(2).max(20),
  isActive: z.boolean(),
}).refine((z2) => z2.etaMaxDays >= z2.etaMinDays, { path: ["etaMaxDays"], message: "Max days must be ≥ min days." });

export async function saveZoneAction(input: z.input<typeof zoneSchema>): Promise<SettingsResult> {
  const session = await requireRole(["admin"], "/admin/delivery");
  const p = zoneSchema.safeParse(input);
  if (!p.success) return invalid(p.error.issues);
  const z2 = p.data;
  try {
    const rows = await asUser(session.userId, (q) =>
      q.query(
        `update public.delivery_zones set fee_kobo = $2, eta_min_days = $3, eta_max_days = $4, same_day_enabled = $5, hub_code = $6, is_active = $7
          where state = $1 returning state`,
        [z2.state, z2.fee, z2.etaMinDays, z2.etaMaxDays, z2.sameDayEnabled, z2.hubCode, z2.isActive],
      ),
    );
    if (!rows[0]) return { ok: false, error: "Zone not found." };
  } catch (err) {
    return pgError(err, "Couldn't save the zone.");
  }
  await auditAdmin(session.userId, "delivery_zone.update", "delivery_zone", z2.state, { fee_kobo: z2.fee, eta: [z2.etaMinDays, z2.etaMaxDays], same_day: z2.sameDayEnabled });
  revalidatePath("/", "layout");
  return { ok: true, message: `${z2.state} saved.` };
}

const categorySchema = z.object({
  id: z.uuid().nullable().optional(),
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().max(60).optional(),
  emoji: z.string().trim().max(8).optional().transform((v) => v || null),
  icon: z.string().trim().regex(/^[a-z0-9_-]{1,40}$/).default("category"),
  description: z.string().trim().max(240).optional().transform((v) => v || null),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export async function saveCategoryAction(input: z.input<typeof categorySchema>): Promise<SettingsResult> {
  const session = await requireRole(["admin"], "/admin/categories");
  const p = categorySchema.safeParse(input);
  if (!p.success) return invalid(p.error.issues);
  const c = p.data;
  const slug = c.slug ? c.slug.toLowerCase() : slugify(c.name);
  if (!SLUG_RE.test(slug)) return { ok: false, error: "Invalid slug.", fieldErrors: { slug: "Invalid slug" } };
  try {
    await asUser(session.userId, (q) =>
      c.id
        ? q.query("update public.categories set name = $2, slug = $3, emoji = $4, icon = $5, description = $6, sort_order = $7, is_active = $8 where id = $1", [
            c.id, c.name, slug, c.emoji, c.icon, c.description, c.sortOrder, c.isActive,
          ])
        : q.query("insert into public.categories (name, slug, emoji, icon, description, sort_order, is_active) values ($1, $2, $3, $4, $5, $6, $7)", [
            c.name, slug, c.emoji, c.icon, c.description, c.sortOrder, c.isActive,
          ]),
    );
  } catch (err) {
    return pgError(err, "Couldn't save the category.");
  }
  await auditAdmin(session.userId, c.id ? "category.update" : "category.create", "category", c.id ?? slug, { slug, active: c.isActive });
  revalidateCatalog();
  revalidatePath("/", "layout");
  revalidatePath("/admin/categories");
  return { ok: true, message: "Category saved." };
}

const moderateSchema = z.object({ id: z.uuid(), status: z.enum(["approved", "rejected", "pending"]) });

/** Approve/reject reviews (ratings aggregates are refreshed by trigger). */
export async function moderateReviewAction(input: z.input<typeof moderateSchema>): Promise<SettingsResult> {
  const session = await requireRole(["admin"], "/admin/reviews");
  const p = moderateSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request." };
  const rows = await asUser(session.userId, (q) =>
    q.query<{ slug: string }>(
      "update public.reviews r set status = $2::public.review_status from public.products p where r.id = $1 and p.id = r.product_id returning p.slug",
      [p.data.id, p.data.status],
    ),
  );
  if (!rows[0]) return { ok: false, error: "Review not found." };
  await auditAdmin(session.userId, `review.${p.data.status}`, "review", p.data.id);
  revalidateCatalog(rows[0].slug);
  revalidatePath("/admin/reviews");
  return { ok: true, message: `Review ${p.data.status}.` };
}

const memberSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.email(),
  phone: z.string().optional().transform((v, ctx) => {
    if (!v?.trim()) return null;
    const ph = normalizeNgPhone(v);
    if (!ph.ok) {
      ctx.addIssue({ code: "custom", message: ph.error });
      return z.NEVER;
    }
    return ph.e164;
  }),
  role: z.enum(["admin", "staff", "dispatcher"]),
  hubCode: z.string().trim().max(20).optional().transform((v) => v || null),
  password: z.string().min(10, "Use at least 10 characters.").max(100),
});

/** Creates a staff / dispatcher / admin account (they sign in at /login with email + password). */
export async function createTeamMemberAction(input: z.input<typeof memberSchema>): Promise<SettingsResult> {
  const session = await requireRole(["admin"], "/admin/team");
  const p = memberSchema.safeParse(input);
  if (!p.success) return invalid(p.error.issues);
  const m = p.data;
  const created = await createUser({ email: m.email, phone: m.phone, password: m.password, fullName: m.fullName });
  if (!created.ok) return { ok: false, error: created.error, fieldErrors: { email: created.error } };
  try {
    await asUser(session.userId, (q) =>
      q.query(
        `insert into public.profiles (id, role, full_name, email, phone, hub_code) values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, email = excluded.email,
                                        phone = excluded.phone, hub_code = excluded.hub_code`,
        [created.userId, m.role, m.fullName, m.email.toLowerCase(), m.phone, m.hubCode],
      ),
    );
  } catch (err) {
    return pgError(err, "Account created but the role couldn't be set — edit it below.");
  }
  await auditAdmin(session.userId, "team.create", "profile", created.userId, { role: m.role, email: m.email });
  revalidatePath("/admin/team");
  return { ok: true, message: `${m.fullName} can now sign in as ${m.role}.` };
}

const updateMemberSchema = z.object({
  id: z.uuid(),
  role: z.enum(["admin", "staff", "dispatcher", "supplier", "customer"]),
  isActive: z.boolean(),
  hubCode: z.string().trim().max(20).nullable().optional().transform((v) => v || null),
});

export async function updateTeamMemberAction(input: z.input<typeof updateMemberSchema>): Promise<SettingsResult> {
  const session = await requireRole(["admin"], "/admin/team");
  const p = updateMemberSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request." };
  if (p.data.id === session.userId && (p.data.role !== "admin" || !p.data.isActive)) {
    return { ok: false, error: "You can't remove your own admin access." };
  }
  const rows = await asUser(session.userId, (q) =>
    q.query("update public.profiles set role = $2::public.app_role, is_active = $3, hub_code = $4 where id = $1 returning id", [
      p.data.id, p.data.role, p.data.isActive, p.data.hubCode,
    ]),
  );
  if (!rows[0]) return { ok: false, error: "User not found." };
  await auditAdmin(session.userId, "team.update", "profile", p.data.id, { role: p.data.role, active: p.data.isActive });
  revalidatePath("/admin/team");
  return { ok: true, message: "Updated." };
}
