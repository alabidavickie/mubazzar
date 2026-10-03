import "server-only";
import { cache } from "react";
import { asAnon, asService } from "../db";
import type { DeliveryZone } from "@/lib/delivery";
import type { ChatChannel } from "@/lib/chat/links";

export interface HeroSettings {
  badge: string;
  badgeNote: string;
  headline: string;
  highlight: string;
  subtext: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string | null;
}

export interface PublicSettings {
  promoStrip: string;
  hero: HeroSettings;
  trustBar: { icon: string; text: string; tone: "emerald" | "gold" }[];
  sameDayCutoff: string;
  support: { whatsapp: string; phone: string; hours: string; email: string };
  business: { legalName: string; address: string; cac: string; returnsDays: number };
  flashSection: { title: string; subtitle: string };
  showSampleReviews: boolean;
}

const DEFAULTS: PublicSettings = {
  promoStrip: "🇳🇬 Fast Nationwide Delivery | Pay on Delivery available — arrange in chat | 24/7 WhatsApp Support",
  hero: {
    badge: "FLASH SALE",
    badgeNote: "",
    headline: "Viral Smart Gadgets",
    highlight: "",
    subtext: "",
    ctaLabel: "Shop Deals",
    ctaHref: "/deals",
    imageUrl: null,
  },
  trustBar: [],
  sameDayCutoff: "14:00",
  support: { whatsapp: "+2348120008899", phone: "+2348120008899", hours: "Mon - Sat: 8AM - 8PM", email: "support@mubazzar.ng" },
  business: { legalName: "MUBAZZAR Nigeria Ltd.", address: "Lagos, Nigeria", cac: "", returnsDays: 7 },
  flashSection: { title: "Flash Deals", subtitle: "" },
  showSampleReviews: false,
};

export const getPublicSettings = cache(async (): Promise<PublicSettings> => {
  const rows = await asAnon((q) =>
    q.query<{ key: string; value: unknown }>("select key, value from public.settings where is_public"),
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    promoStrip: (map.get("promo_strip") as string) ?? DEFAULTS.promoStrip,
    hero: { ...DEFAULTS.hero, ...((map.get("hero") as Partial<HeroSettings>) ?? {}) },
    trustBar: (map.get("trust_bar") as PublicSettings["trustBar"]) ?? DEFAULTS.trustBar,
    sameDayCutoff: (map.get("same_day_cutoff") as string) ?? DEFAULTS.sameDayCutoff,
    support: { ...DEFAULTS.support, ...((map.get("support") as object) ?? {}) },
    business: { ...DEFAULTS.business, ...((map.get("business") as object) ?? {}) },
    flashSection: { ...DEFAULTS.flashSection, ...((map.get("flash_section") as object) ?? {}) },
    showSampleReviews: map.get("show_sample_reviews") === true,
  };
});

export const getDeliveryZones = cache(async (): Promise<DeliveryZone[]> =>
  asAnon((q) =>
    q.query<DeliveryZone>(
      `select state, display_name as "displayName", fee_kobo as "feeKobo", eta_min_days as "etaMinDays",
              eta_max_days as "etaMaxDays", same_day_enabled as "sameDayEnabled", hub_code as "hubCode"
         from public.delivery_zones where is_active order by sort_order, state`,
    ),
  ),
);

/** Enabled channels only — disabled channels never reach the client. */
export const getEnabledChannels = cache(async (): Promise<ChatChannel[]> =>
  asAnon((q) =>
    q.query<ChatChannel>(
      `select id, kind, label, handle, hub_code as "hubCode", weight, is_enabled as "isEnabled", sort_order as "sortOrder"
         from public.chat_channels where is_enabled order by sort_order`,
    ),
  ),
);

/** Private settings (bank details, templates, routing) — staff/admin and trusted server code only. */
export async function getPrivateSetting<T>(key: string, fallback: T): Promise<T> {
  const rows = await asService((q) => q.query<{ value: T }>("select value from public.settings where key = $1", [key]));
  return rows[0]?.value ?? fallback;
}
