"use client";

/**
 * First-touch ad attribution (UTM + fbclid) captured on landing and attached to orders.
 * Stored in a first-party cookie for 7 days so it survives navigation from LP → checkout.
 */
const COOKIE = "mbz_attr";
const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;

export type Attribution = Partial<Record<(typeof KEYS)[number] | "fbc" | "fbp", string>>;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

export function captureAttribution(search: string = typeof window !== "undefined" ? window.location.search : ""): void {
  const params = new URLSearchParams(search);
  const fresh: Attribution = {};
  for (const k of KEYS) {
    const v = params.get(k);
    if (v) fresh[k] = v.slice(0, 200);
  }
  if (!Object.keys(fresh).length) return;
  // Meta click id cookie format: fb.1.<timestamp>.<fbclid>
  if (fresh.fbclid) {
    document.cookie = `_fbc=${encodeURIComponent(`fb.1.${Date.now()}.${fresh.fbclid}`)}; path=/; max-age=${90 * 86400}; samesite=lax`;
  }
  const existing = readAttribution();
  // First touch wins for campaign data, but a new ad click (fbclid) refreshes it.
  const next = existing.utm_source && !fresh.fbclid ? existing : fresh;
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=${7 * 86400}; samesite=lax`;
}

export function readAttribution(): Attribution {
  try {
    const raw = readCookie(COOKIE);
    const parsed = raw ? (JSON.parse(raw) as Attribution) : {};
    const fbc = readCookie("_fbc");
    const fbp = readCookie("_fbp");
    return { ...parsed, ...(fbc ? { fbc } : {}), ...(fbp ? { fbp } : {}) };
  } catch {
    return {};
  }
}
