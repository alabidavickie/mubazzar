import { parseVideoLink } from "@/lib/video-embed";

/** Only these public hosts are ever requested, over https, so a pasted link can't reach internal addresses. */
const ALLOWED_HOST = /(?:^|\.)(?:facebook\.com|fb\.com|fb\.watch|instagram\.com|tiktok\.com|x\.com|twitter\.com|t\.co)$/i;
const MAX_HOPS = 5;
const BROWSER_UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, "status" | "headers">>;

function isFullLink(url: string) {
  const r = parseVideoLink(url);
  return r.ok && !r.video.shortLink && r.video.embedUrl ? r.video.url : null;
}

/** Follows a share link's redirects until they reach a full post/video link. Null if they never do. */
export async function expandShortVideoLink(start: string, fetchImpl: FetchLike = fetch): Promise<string | null> {
  let current = start;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const u = new URL(current);
    if (u.protocol !== "https:" || !ALLOWED_HOST.test(u.hostname)) return null;
    let location: string | null;
    try {
      const res = await fetchImpl(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
        headers: { "user-agent": BROWSER_UA, accept: "text/html" },
      });
      location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    } catch {
      return null;
    }
    if (!location) return null;
    current = new URL(location, current).toString();
    const full = isFullLink(current);
    if (full) return full;
  }
  return null;
}

export type NormalizedVideoLink = { ok: true; url: string | null } | { ok: false; message: string };

/**
 * The link to store: tracking parameters removed and share links expanded to the real post. Facebook's player
 * can usually open its own share links, so those are kept if expanding fails; other short links can't play.
 */
export async function normalizeVideoLink(url: string | null | undefined, fetchImpl: FetchLike = fetch): Promise<NormalizedVideoLink> {
  if (!url) return { ok: true, url: null };
  const parsed = parseVideoLink(url);
  // Unusable links were already rejected or tolerated by the schema; never make a save fail here for those.
  if (!parsed.ok) return { ok: true, url };
  if (!parsed.video.shortLink) return { ok: true, url: parsed.video.url };
  const expanded = await expandShortVideoLink(parsed.video.url, fetchImpl);
  if (expanded) return { ok: true, url: expanded };
  if (parsed.video.embedUrl) return { ok: true, url: parsed.video.url };
  return { ok: false, message: "We couldn't open that short link. Open it in your browser, then copy the full address from the address bar." };
}
