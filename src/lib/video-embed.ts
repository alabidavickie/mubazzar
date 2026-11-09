/**
 * Turns a video link the admin pasted (Facebook, Instagram, TikTok, X, YouTube, Vimeo or a direct file)
 * into a safe embed URL. Pure and isomorphic: the admin form uses it for instant feedback, the Zod schemas
 * to reject unusable links, and the landing page to render. Embed URLs are BUILT from parsed IDs on fixed
 * hosts, never copied from the input, so a pasted link cannot put an arbitrary page in an iframe.
 * Each host here must also be in frame-src in next.config.ts (plus web. and m.facebook.com: Facebook redirects
 * visitors in some regions, Nigeria included, to those hosts).
 */

export type VideoPlatform = "youtube" | "vimeo" | "facebook" | "instagram" | "tiktok" | "x" | "direct";

export const VIDEO_PLATFORM_LABEL: Record<VideoPlatform, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X (Twitter)",
  direct: "Direct video file",
};

export interface VideoLink {
  platform: VideoPlatform;
  /** Null for a direct file (native <video>) or a short link that must be expanded on the server first. */
  embedUrl: string | null;
  /** Tall player for reels, TikToks and social posts. */
  vertical: boolean;
  /** A redirecting share link (fb.watch, vm.tiktok.com, /share/…): the server swaps it for the full link on save. */
  shortLink: boolean;
  /** The link to store: tracking parameters removed for social links. */
  url: string;
}

export type VideoLinkResult = { ok: true; video: VideoLink } | { ok: false; message: string };

const SUPPORTED = "Facebook, Instagram, TikTok, X, YouTube or Vimeo";
const fail = (message: string): VideoLinkResult => ({ ok: false, message });
const notEmbeddable = (name: string) => fail(`${name} videos can't be played on other websites. Use a link from ${SUPPORTED}.`);

const NOT_EMBEDDABLE: Record<string, string> = {
  "threads.net": "Threads",
  "threads.com": "Threads",
  "snapchat.com": "Snapchat",
  "pinterest.com": "Pinterest",
  "pin.it": "Pinterest",
  "linkedin.com": "LinkedIn",
  "whatsapp.com": "WhatsApp",
  "wa.me": "WhatsApp",
  "t.me": "Telegram",
};

function facebookVideo(path: string, vertical: boolean, shortLink = false, url = `https://www.facebook.com${path}`): VideoLink {
  return {
    platform: "facebook",
    embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`,
    vertical,
    shortLink,
    url,
  };
}

/** A post (with or without a video in it): Facebook's post plugin plays the video inside the post. */
function facebookPost(url: string, shortLink = false): VideoLink {
  return {
    platform: "facebook",
    embedUrl: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=350`,
    vertical: true,
    shortLink,
    url,
  };
}

function parseFacebook(u: URL): VideoLinkResult {
  const path = u.pathname.replace(/\/+$/, "") || "/";
  const clean = `https://www.facebook.com${path}`;
  if (u.hostname.replace(/^www\./, "") === "fb.watch") {
    return /^\/[\w-]+$/.test(path)
      ? { ok: true, video: facebookVideo(path, false, true, `https://fb.watch${path}/`) }
      : fail("That fb.watch link looks incomplete. Copy it again from Facebook.");
  }
  const share = /^\/share\/(?:(v|r|p)\/)?([\w-]+)$/.exec(path);
  if (share) {
    const video = share[1] === "v" || share[1] === "r";
    // Share links keep their trailing slash: without it Facebook adds a redirect before the real one.
    const link = `${clean}/`;
    return { ok: true, video: video ? facebookVideo(path, share[1] === "r", true, link) : facebookPost(link, true) };
  }
  if (path === "/watch" || path === "/watch/live") {
    const v = u.searchParams.get("v");
    if (v && /^\d+$/.test(v)) return { ok: true, video: facebookVideo(`/watch/?v=${v}`, false) };
  }
  if (/^\/reel\/\d+$/.test(path)) return { ok: true, video: facebookVideo(path, true) };
  if (/^\/(?:[^/]+\/)?videos\/(?:[^/]+\/)?\d+$/.test(path)) return { ok: true, video: facebookVideo(path, false) };
  if (/^\/[^/]+\/posts\/[\w.-]+$/.test(path)) return { ok: true, video: facebookPost(clean) };
  if (path === "/permalink.php" || path === "/story.php") {
    const story = u.searchParams.get("story_fbid");
    const owner = u.searchParams.get("id");
    if (story && owner && /^[\w.-]+$/.test(story) && /^\d+$/.test(owner)) {
      return { ok: true, video: facebookPost(`https://www.facebook.com/permalink.php?story_fbid=${story}&id=${owner}`) };
    }
  }
  return fail("That Facebook link isn't a post or video. Open the post, tap Share, then Copy link.");
}

function parseInstagram(u: URL): VideoLinkResult {
  const path = u.pathname.replace(/\/+$/, "");
  if (path.startsWith("/share/")) {
    return /^\/share\/(?:(?:reel|p|tv)\/)?[\w-]+$/.test(path)
      ? { ok: true, video: { platform: "instagram", embedUrl: null, vertical: true, shortLink: true, url: `https://www.instagram.com${path}/` } }
      : fail("That Instagram link looks incomplete. Copy it again from Instagram.");
  }
  if (path.startsWith("/stories/")) return fail("Instagram stories disappear after 24 hours. Use a link to a post or reel.");
  const m = /^\/(?:[\w.]+\/)?(reels?|p|tv)\/([\w-]{5,})$/.exec(path);
  if (!m) return fail("That Instagram link isn't a post or reel. Open the post, tap Share, then Copy link.");
  const kind = m[1] === "reels" ? "reel" : m[1]!;
  return {
    ok: true,
    video: { platform: "instagram", embedUrl: `https://www.instagram.com/p/${m[2]}/embed/`, vertical: true, shortLink: false, url: `https://www.instagram.com/${kind}/${m[2]}/` },
  };
}

function parseTikTok(u: URL, host: string): VideoLinkResult {
  const path = u.pathname.replace(/\/+$/, "");
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com" || path.startsWith("/t/")) {
    return { ok: true, video: { platform: "tiktok", embedUrl: null, vertical: true, shortLink: true, url: `https://${host}${path}/` } };
  }
  if (path.includes("/photo/")) return fail("That TikTok is a photo post. Use a link to a video.");
  const m = /^\/(?:@[\w.-]+\/video|v)\/(\d{8,25})(?:\.html)?$/.exec(path);
  if (!m) return fail("That TikTok link isn't a video. Open the video, tap Share, then Copy link.");
  const handle = /^\/(@[\w.-]+)\//.exec(path)?.[1] ?? "@tiktok";
  return {
    ok: true,
    video: { platform: "tiktok", embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`, vertical: true, shortLink: false, url: `https://www.tiktok.com/${handle}/video/${m[1]}` },
  };
}

function parseX(u: URL, host: string): VideoLinkResult {
  const path = u.pathname.replace(/\/+$/, "");
  if (host === "t.co") return { ok: true, video: { platform: "x", embedUrl: null, vertical: true, shortLink: true, url: `https://t.co${path}` } };
  const m = /^\/(?:([\w]+|i(?:\/web)?)\/)?status(?:es)?\/(\d{5,25})/.exec(path);
  if (!m) return fail("That X link isn't a post. Open the post, tap Share, then Copy link.");
  return {
    ok: true,
    video: { platform: "x", embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${m[2]}&dnt=true`, vertical: true, shortLink: false, url: `https://x.com/i/status/${m[2]}` },
  };
}

function parseYouTube(u: URL, host: string, raw: string): VideoLinkResult {
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
  else if (u.pathname === "/watch") id = u.searchParams.get("v");
  else id = /^\/(?:embed|shorts|live)\/([^/?#]+)/.exec(u.pathname)?.[1] ?? null;
  if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return fail("That YouTube link isn't a video. Open the video, tap Share, then Copy.");
  return {
    ok: true,
    video: {
      platform: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
      vertical: u.pathname.startsWith("/shorts/"),
      shortLink: false,
      url: raw,
    },
  };
}

export function parseVideoLink(raw: string | null | undefined): VideoLinkResult {
  if (!raw?.trim()) return fail("Paste a link to the video.");
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return fail(`Paste the full link, starting with https:// (from ${SUPPORTED}).`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return fail("Paste a link that starts with https://.");
  const fullHost = u.hostname.toLowerCase();
  const host = fullHost.replace(/^(?:www|m|web|mbasic|mobile)\./, "");

  const blocked = NOT_EMBEDDABLE[host];
  if (blocked) return notEmbeddable(blocked);
  if (host === "facebook.com" || host === "fb.com" || host === "fb.watch") return parseFacebook(u);
  if (host === "instagram.com" || host === "instagr.am") return parseInstagram(u);
  if (host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com") return parseTikTok(u, host);
  if (host === "x.com" || host === "twitter.com" || host === "t.co") return parseX(u, host);
  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") return parseYouTube(u, host, raw.trim());
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = /(?:\/video\/|\/|^)(\d{6,12})/.exec(u.pathname)?.[1];
    if (!id) return fail("That Vimeo link isn't a video.");
    return { ok: true, video: { platform: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1`, vertical: false, shortLink: false, url: raw.trim() } };
  }
  return { ok: true, video: { platform: "direct", embedUrl: null, vertical: false, shortLink: false, url: raw.trim() } };
}

/** Safe embed URL, or null when the link should play in a native <video> or can't be played. */
export function videoEmbedUrl(url: string | null | undefined): string | null {
  const r = parseVideoLink(url);
  return r.ok ? r.video.embedUrl : null;
}

/**
 * Message for a link that can never play, for the form schemas. YouTube and Vimeo stay lenient here, as they
 * always were: the landing page simply hides a player it cannot build.
 */
export function videoLinkProblem(url: string | null | undefined): string | null {
  if (!url) return null;
  const r = parseVideoLink(url);
  if (r.ok || /youtu\.?be|vimeo/i.test(url)) return null;
  return r.message;
}
