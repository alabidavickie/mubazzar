import { randomBytes, scryptSync } from "node:crypto";
import type { Queryable } from "../types-core";
import { CATEGORIES, PRODUCTS, faqsFor, featuresFor } from "./catalog";
import { seedId } from "./ids";
import {
  CHAT_CHANNELS,
  HUBS,
  LANDING_PAGE,
  SAMPLE_REVIEWS,
  SAMPLE_SUPPLIER,
  SETTINGS,
  USERS,
  ZONES,
} from "./reference";

export { seedId } from "./ids";
export { USERS as SEED_USERS } from "./reference";

export interface SeedOptions {
  /** pglite → local shim auth.users; supabase → real auth.users + auth.identities via pgcrypto */
  target: "pglite" | "supabase";
  includeUsers?: boolean;
  includeSamples?: boolean;
}

class Raw {
  constructor(readonly sql: string) {}
}
const raw = (sql: string) => new Raw(sql);

type Lit = string | number | boolean | null | undefined | Raw | string[] | { json: unknown };

function lit(v: Lit): string {
  if (v === null || v === undefined) return "null";
  if (v instanceof Raw) return v.sql;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("non-finite number in seed");
    return String(v);
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.length ? `array[${v.map((s) => lit(s)).join(", ")}]::text[]` : "'{}'::text[]";
  if (typeof v === "object" && "json" in v) return `${lit(JSON.stringify(v.json))}::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function insert(table: string, row: Record<string, Lit>, conflict = ""): string {
  const cols = Object.keys(row);
  return `insert into ${table} (${cols.join(", ")}) values (${cols.map((c) => lit(row[c])).join(", ")})${conflict};`;
}

const kobo = (naira: number | null) => (naira === null ? null : Math.round(naira * 100));
const productImage = (file: string) => `/images/products/${file}`;
const ago = (days: number) => raw(`now() - interval '${days} days'`);

/** Lagos midnight `days` from today (Lagos = UTC+1, so 23:00 UTC). */
const lagosMidnightIn = (days: number) =>
  raw(`date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + interval '${days} days' - interval '1 hour'`);

/** One real deadline for every seeded promo (bundle promo prices, flash deals, promo gifts). */
const PROMO_ENDS_AT = lagosMidnightIn(3);

function hashPasswordLocal(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function buildSeedStatements(opts: SeedOptions): string[] {
  const includeUsers = opts.includeUsers ?? true;
  const includeSamples = opts.includeSamples ?? true;
  const out: string[] = [];

  // Hubs
  for (const h of HUBS) {
    out.push(
      insert("public.hubs", {
        id: seedId("hub", h.code),
        code: h.code,
        name: h.name,
        city: h.city,
        state: h.state,
        is_fulfilment_fallback: h.fallback,
        sort_order: h.sort,
      }),
    );
  }

  // Categories
  CATEGORIES.forEach((c, i) =>
    out.push(
      insert("public.categories", {
        id: seedId("category", c.slug),
        slug: c.slug,
        name: c.name,
        short_name: c.shortName,
        emoji: c.emoji,
        icon: c.icon,
        description: c.description,
        sort_order: i + 1,
      }),
    ),
  );

  // Delivery zones (36 states + FCT)
  ZONES.forEach(([state, fee, min, max, sameDay, hub], i) =>
    out.push(
      insert("public.delivery_zones", {
        state,
        display_name: state === "FCT" ? "Abuja (FCT)" : `${state} State`,
        fee_kobo: kobo(fee),
        eta_min_days: min,
        eta_max_days: max,
        same_day_enabled: sameDay,
        hub_code: hub,
        sort_order: i < 2 ? i + 1 : 100,
      }),
    ),
  );

  // Settings
  // Production seed: no dev contact data and no sample-review switch left on.
  const productionOverrides: Record<string, unknown> = { admin_alerts: { emails: [], phones: [] }, show_sample_reviews: false };
  for (const s of SETTINGS) {
    const value = !includeSamples && s.key in productionOverrides ? productionOverrides[s.key] : s.value;
    out.push(
      insert("public.settings", {
        key: s.key,
        value: { json: value },
        is_public: s.isPublic,
        description: s.description,
      }),
    );
  }

  // Chat channels
  for (const c of CHAT_CHANNELS) {
    out.push(
      insert("public.chat_channels", {
        id: seedId("channel", c.key),
        kind: raw(`'${c.kind}'::public.chat_channel_kind`),
        label: c.label,
        handle: c.handle,
        hub_code: c.hub,
        weight: c.weight,
        is_enabled: c.enabled,
        sort_order: c.sort,
      }),
    );
  }

  // Users (dev/test only)
  if (includeUsers) {
    for (const u of USERS) {
      const id = seedId("user", u.key);
      if (opts.target === "pglite") {
        out.push(
          insert("auth.users", {
            id,
            email: u.email,
            phone: u.phone,
            encrypted_password: hashPasswordLocal(u.password),
            raw_user_meta_data: { json: { full_name: u.fullName } },
          }),
        );
      } else {
        out.push(
          insert("auth.users", {
            instance_id: "00000000-0000-0000-0000-000000000000",
            id,
            aud: "authenticated",
            role: "authenticated",
            email: u.email,
            encrypted_password: raw(`extensions.crypt(${lit(u.password)}, extensions.gen_salt('bf'))`),
            email_confirmed_at: raw("now()"),
            phone: u.phone.replace("+", ""),
            phone_confirmed_at: raw("now()"),
            raw_app_meta_data: { json: { provider: "email", providers: ["email", "phone"] } },
            raw_user_meta_data: { json: { full_name: u.fullName } },
            created_at: raw("now()"),
            updated_at: raw("now()"),
            confirmation_token: "",
            recovery_token: "",
            email_change_token_new: "",
            email_change: "",
          }),
        );
        out.push(
          insert("auth.identities", {
            id: seedId("identity", u.key),
            user_id: id,
            provider_id: id,
            identity_data: { json: { sub: id, email: u.email, email_verified: true } },
            provider: "email",
            last_sign_in_at: raw("now()"),
            created_at: raw("now()"),
            updated_at: raw("now()"),
          }),
        );
      }
      // handle_new_user() created the profile as 'customer'; promote it.
      out.push(
        `update public.profiles set role = ${lit(u.role)}::public.app_role, full_name = ${lit(u.fullName)}, phone = ${lit(
          u.phone,
        )}, email = ${lit(u.email)}, hub_code = ${lit(u.hub ?? null)} where id = ${lit(id)};`,
      );
    }
    out.push(
      insert("public.suppliers", {
        id: seedId("supplier", "sample"),
        user_id: seedId("user", "supplier"),
        business_name: SAMPLE_SUPPLIER.businessName,
        contact_name: SAMPLE_SUPPLIER.contactName,
        phone_e164: SAMPLE_SUPPLIER.phone,
        email: SAMPLE_SUPPLIER.email,
        cac_number: SAMPLE_SUPPLIER.cac,
        categories: SAMPLE_SUPPLIER.categories,
        status: raw("'approved'::public.supplier_status"),
        reviewed_at: raw("now()"),
      }),
    );
  }

  // Products and their children
  for (const p of PRODUCTS) {
    const pid = seedId("product", p.slug);
    out.push(
      insert("public.products", {
        id: pid,
        slug: p.slug,
        name: p.name,
        short_description: p.short,
        description: p.description,
        category_id: seedId("category", p.category),
        price_kobo: kobo(p.price),
        compare_at_kobo: kobo(p.compareAt),
        sku: `MBZ-${p.slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 40)}`,
        tags: p.tags,
        image_badge: p.imageBadge?.text ?? null,
        image_badge_style: p.imageBadge?.style ?? "navy",
        image_badge_icon: p.imageBadge?.icon ?? null,
        perk_text: p.perk?.text ?? null,
        perk_icon: p.perk?.icon ?? null,
        perk_style: p.perk?.style ?? "gold",
        delivery_note: p.deliveryNote?.text ?? null,
        delivery_note_icon: p.deliveryNote?.icon ?? null,
        pod_available: p.podAvailable ?? true,
        warranty_months: p.warrantyMonths ?? 0,
        specs: { json: p.specs ?? [] },
        curated_rank: p.curated?.rank ?? null,
        curated_label: p.curated?.label ?? null,
        seo_title: `${p.name} | MUBAZZAR`,
        seo_description: p.short,
        created_at: ago(p.ageDays),
      }),
    );
    p.images.forEach((im, i) =>
      out.push(
        insert("public.product_images", {
          id: seedId("image", `${p.slug}:${i}`),
          product_id: pid,
          url: productImage(im.file),
          alt: im.alt,
          sort_order: i,
        }),
      ),
    );
    featuresFor(p).forEach((f, i) =>
      out.push(
        insert("public.product_features", {
          id: seedId("feature", `${p.slug}:${i}`),
          product_id: pid,
          icon: f.icon,
          title: f.title,
          description: f.description,
          sort_order: i,
        }),
      ),
    );
    faqsFor(p).forEach((f, i) =>
      out.push(
        insert("public.product_faqs", {
          id: seedId("faq", `${p.slug}:${i}`),
          product_id: pid,
          question: f.q,
          answer: f.a,
          sort_order: i,
        }),
      ),
    );
    if (p.gift) {
      out.push(
        insert("public.free_gifts", {
          id: seedId("gift", p.slug),
          product_id: pid,
          name: p.gift.name,
          value_kobo: kobo(p.gift.value),
          image_url: p.gift.image ? productImage(p.gift.image) : null,
          conditions: p.gift.conditions,
          ends_at: p.gift.endsWithPromo ? PROMO_ENDS_AT : null,
        }),
      );
    }
    (p.bundles ?? []).forEach((b, i) =>
      out.push(
        insert("public.bundles", {
          id: seedId("bundle", `${p.slug}:${b.key}`),
          product_id: pid,
          label: b.label,
          short_label: b.shortLabel,
          description: b.description,
          quantity: b.quantity,
          price_kobo: kobo(b.price),
          promo_price_kobo: b.promo === undefined ? null : kobo(b.promo),
          promo_ends_at: b.promo === undefined ? null : PROMO_ENDS_AT,
          compare_at_kobo: kobo(b.compareAt),
          tag: b.tag ?? null,
          side_tag: b.sideTag ?? null,
          note: b.note ?? null,
          is_popular: b.popular ?? false,
          sort_order: i,
        }),
      ),
    );
    HUBS.forEach((h, i) =>
      out.push(
        insert("public.inventory", {
          product_id: pid,
          hub_id: seedId("hub", h.code),
          on_hand: p.stock[i]!,
          reserved: 0,
          batch_size: p.batch?.[i] ?? p.stock[i]!,
          low_stock_threshold: 10,
        }),
      ),
    );
  }

  // Flash deals: real lower prices with the same real deadline as the product's bundle promos.
  for (const p of PRODUCTS) {
    if (!p.flash) continue;
    out.push(
      insert("public.flash_deals", {
        id: seedId("flash", p.slug),
        product_id: seedId("product", p.slug),
        title: p.flash.title,
        promo_text: p.flash.promoText,
        deal_price_kobo: kobo(p.flash.price),
        starts_at: ago(1),
        ends_at: PROMO_ENDS_AT,
        sort_order: p.flash.sort,
      }),
    );
  }

  // Landing page
  const lp = LANDING_PAGE;
  const lpId = seedId("lp", lp.slug);
  out.push(
    insert("public.landing_pages", {
      id: lpId,
      slug: lp.slug,
      product_id: seedId("product", lp.product),
      is_published: true,
      hook_label: lp.hookLabel,
      hook_banner: lp.hookBanner,
      trend_badge: lp.trendBadge,
      headline: lp.headline,
      subheadline: lp.subheadline,
      hero_overlay_text: lp.heroOverlayText,
      hero_overlay_icon: lp.heroOverlayIcon,
      warranty_badge: lp.warrantyBadge,
      regions_text: lp.regionsText,
      // Legacy column: no longer drives the countdown (the product's live promo deadline does).
      campaign_ends_at: PROMO_ENDS_AT,
      features_title: lp.featuresTitle,
      features_subtitle: lp.featuresSubtitle,
      video_url: lp.videoUrl,
      video_poster_url: productImage(lp.videoPoster),
      video_title: lp.videoTitle,
      video_subtitle: lp.videoSubtitle,
      cta_label: lp.ctaLabel,
      seo_title: lp.seoTitle,
      seo_description: lp.seoDescription,
      og_image_url: productImage("car-vacuum-hero.webp"),
    }),
    insert("public.landing_page_sections", {
      id: seedId("lp-section", `${lp.slug}:trust`),
      landing_page_id: lpId,
      kind: "trust_matrix",
      title: "Shop With Zero Risk",
      items: { json: lp.trustMatrix },
      sort_order: 1,
    }),
  );

  // Sample reviews (clearly flagged)
  if (includeSamples) {
    SAMPLE_REVIEWS.forEach((r, i) =>
      out.push(
        insert("public.reviews", {
          id: seedId("review", String(i)),
          product_id: seedId("product", r.product),
          author_name: r.name,
          location: r.location,
          rating: r.rating,
          body: r.body,
          status: raw("'approved'::public.review_status"),
          is_verified_purchase: false,
          is_sample: true,
          created_at: ago(r.daysAgo),
        }),
      ),
    );
  }

  return out;
}

export async function seedDatabase(db: Queryable & { transaction?: unknown }, opts: SeedOptions): Promise<void> {
  const statements = buildSeedStatements(opts);
  await db.exec(`begin;\n${statements.join("\n")}\ncommit;`);
}

export function seedSql(opts: SeedOptions): string {
  return [
    "-- Generated by `pnpm db:seed-sql`. Do not edit by hand; edit src/server/db/seed/*.ts instead.",
    "-- Includes dev test accounts and sample reviews only when generated with those options.",
    "begin;",
    ...buildSeedStatements(opts),
    "commit;",
    "",
  ].join("\n");
}
