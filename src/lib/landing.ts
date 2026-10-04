import { NG_REGION_CODES } from "./ng-states";
import type { Kobo } from "./money";

/** Pure helpers for the ad landing page (`/lp/[slug]`). */

export const DEFAULT_HUB = "lagos";

/**
 * Visitor's nearest hub from Vercel's geo headers (`x-vercel-ip-country` + `x-vercel-ip-country-region`,
 * ISO 3166-2:NG subdivision code like "LA" or "FC") → state → that state's delivery-zone hub.
 * Falls back to Lagos (the main hub) when the visitor is outside Nigeria or the header is missing.
 */
export function nearestHubFromGeo(
  country: string | null | undefined,
  region: string | null | undefined,
  zones: { state: string; hubCode: string }[],
  fallback = DEFAULT_HUB,
): { hubCode: string; state: string | null } {
  if (country && country.toUpperCase() !== "NG") return { hubCode: fallback, state: null };
  const code = region?.trim().toUpperCase().replace(/^NG-/, "") ?? "";
  const state = NG_REGION_CODES[code] ?? null;
  if (!state) return { hubCode: fallback, state: null };
  const zone = zones.find((z) => z.state === state);
  return { hubCode: zone?.hubCode ?? fallback, state };
}

/** Hub that ships to a chosen delivery state (zone.hubCode), or null when unknown. */
export function hubForState(state: string | null | undefined, zones: { state: string; hubCode: string }[]): string | null {
  if (!state) return null;
  return zones.find((z) => z.state === state)?.hubCode ?? null;
}

export interface PromoBundle {
  id: string;
  quantity: number;
  priceKobo: Kobo;
  compareAtKobo: Kobo | null;
}

/**
 * The headline price: the single-unit (quantity 1) bundle when there is one, otherwise the product's own
 * price. Prices come from the read models, so they are already the LIVE price (promo while it runs) and
 * the struck price follows the honesty rule (regular price during a promo, else a real compare-at).
 * The product's compare-at is only borrowed when the 1x bundle costs exactly the product price — a
 * compare-at never applies to a different price. The default selection is that 1x bundle (or the first).
 */
export function promoPricing(
  product: { priceKobo: Kobo; compareAtKobo: Kobo | null },
  bundles: PromoBundle[],
): { priceKobo: Kobo; compareAtKobo: Kobo | null; defaultBundleId: string | null } {
  const single = bundles.find((b) => b.quantity === 1) ?? null;
  const defaultBundleId = single?.id ?? bundles[0]?.id ?? null;
  if (single) {
    const compareAtKobo = single.compareAtKobo ?? (single.priceKobo === product.priceKobo ? product.compareAtKobo : null);
    return { priceKobo: single.priceKobo, compareAtKobo, defaultBundleId };
  }
  return { priceKobo: product.priceKobo, compareAtKobo: product.compareAtKobo, defaultBundleId };
}

/** timestamptz arrives as a Date (PGlite) or a string (postgres.js): normalise to ISO, null when invalid. */
export function toIsoOrNull(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** Lowest delivery fee across zones ("Delivery from ₦X" before a state is chosen). */
export function lowestDeliveryFee(zones: { feeKobo: Kobo }[]): Kobo | null {
  return zones.length ? Math.min(...zones.map((z) => z.feeKobo)) : null;
}

/** True when a campaign end is set and still in the future. */
export function isCampaignLive(endsAt: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!endsAt) return false;
  const end = typeof endsAt === "string" ? new Date(endsAt) : endsAt;
  return Number.isFinite(end.getTime()) && end.getTime() > now.getTime();
}

export type LandingTimer = { kind: "live"; endsAt: string } | { kind: "ended" } | { kind: "none" };

/**
 * What the landing page's price timer shows (honesty rule §0.8). It counts down ONLY to the product's
 * real promo deadline (earliest live bundle promo / flash deal end) — the moment the price actually
 * changes. `campaign_ends_at` is never a countdown source; once it has passed (and no promo is live)
 * the page says the promo ended, otherwise no timer is shown at all.
 */
export function landingTimer(
  promoEndsAt: string | Date | null | undefined,
  campaignEndsAt: string | Date | null | undefined,
  now: Date = new Date(),
): LandingTimer {
  const promo = toIsoOrNull(promoEndsAt);
  if (promo && isCampaignLive(promo, now)) return { kind: "live", endsAt: promo };
  const campaign = toIsoOrNull(campaignEndsAt);
  if (campaign && !isCampaignLive(campaign, now)) return { kind: "ended" };
  return { kind: "none" };
}

/** Safe `https://www.youtube-nocookie.com/embed/<id>` for YouTube URLs, else null (use <video>). */
export function youTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = /^\/(?:embed|shorts|live)\/([^/?#]+)/.exec(u.pathname);
      id = m?.[1] ?? null;
    }
  }
  if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
}
