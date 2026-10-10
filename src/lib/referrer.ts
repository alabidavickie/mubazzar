import { safeRedirectPath } from "./safe-redirect";

export interface BackLink {
  href: string;
  /** Destination as a phrase for screen readers: "Back to Shop". */
  label: string;
}

/** Pages a "Back" link must never send the visitor to (private, transactional or staff pages). */
const NEVER_BACK = /^\/(order|checkout|login|admin|dispatch|api)(\/|\?|$)/;

const LABELS: [RegExp, string][] = [
  [/^\/(\?|$)/, "Home"],
  [/^\/shop(\/|\?|$)/, "Shop"],
  [/^\/search(\?|$)/, "search results"],
  [/^\/deals(\?|$)/, "Hot deals"],
  [/^\/c\//, "category"],
  [/^\/cart(\?|$)/, "cart"],
  [/^\/account\/wishlist/, "wishlist"],
  [/^\/account(\/|\?|$)/, "account"],
];

/**
 * A "Back" link for visitors who arrived from another page of this site (same host in the
 * `Referer` header). Ad visitors (Facebook, Instagram, TikTok …) have an off-site or empty referrer
 * and get no link, so the landing page stays distraction-free for them.
 */
export function internalBackLink(referer: string | null | undefined, host: string | null | undefined, currentPath: string): BackLink | null {
  if (!referer || !host) return null;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return null;
  }
  if (url.host.toLowerCase() !== host.toLowerCase()) return null;
  const href = safeRedirectPath(url.pathname + url.search);
  if (!href || NEVER_BACK.test(href)) return null;
  if (href.split("?")[0] === currentPath) return null;
  const label = LABELS.find(([re]) => re.test(href))?.[1] ?? "previous page";
  return { href, label: `Back to ${label}` };
}
