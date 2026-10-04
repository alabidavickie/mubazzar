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
 * The headline promo price: the single-unit (quantity 1) bundle when there is one, otherwise the
 * product's own price. The default selected bundle is that 1x bundle (or the first bundle).
 */
export function promoPricing(
  product: { priceKobo: Kobo; compareAtKobo: Kobo | null },
  bundles: PromoBundle[],
): { priceKobo: Kobo; compareAtKobo: Kobo | null; defaultBundleId: string | null } {
  const single = bundles.find((b) => b.quantity === 1) ?? null;
  const defaultBundleId = single?.id ?? bundles[0]?.id ?? null;
  if (single) {
    return { priceKobo: single.priceKobo, compareAtKobo: single.compareAtKobo ?? product.compareAtKobo, defaultBundleId };
  }
  return { priceKobo: product.priceKobo, compareAtKobo: product.compareAtKobo, defaultBundleId };
}

/** True when a campaign end is set and still in the future. */
export function isCampaignLive(endsAt: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!endsAt) return false;
  const end = typeof endsAt === "string" ? new Date(endsAt) : endsAt;
  return Number.isFinite(end.getTime()) && end.getTime() > now.getTime();
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
