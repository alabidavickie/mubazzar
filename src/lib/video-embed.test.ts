import { describe, expect, it } from "vitest";
import { parseVideoLink, videoEmbedUrl, videoLinkProblem } from "./video-embed";

const ok = (url: string) => {
  const r = parseVideoLink(url);
  if (!r.ok) throw new Error(`${url}: ${r.message}`);
  return r.video;
};
const href = (embed: string | null) => decodeURIComponent(new URL(embed!).searchParams.get("href")!);

describe("Facebook links", () => {
  it("embeds page videos, watch links and reels with the video player", () => {
    const v = ok("https://www.facebook.com/mubazzar.ng/videos/solar-power-bank/1234567890/?mibextid=abc");
    expect(v.platform).toBe("facebook");
    expect(v.embedUrl).toMatch(/^https:\/\/www\.facebook\.com\/plugins\/video\.php\?/);
    expect(href(v.embedUrl)).toBe("https://www.facebook.com/mubazzar.ng/videos/solar-power-bank/1234567890");
    expect(v.url).not.toContain("mibextid");
    expect(href(ok("https://m.facebook.com/watch/?v=987654321&rdid=x").embedUrl)).toBe("https://www.facebook.com/watch/?v=987654321");
    const reel = ok("https://web.facebook.com/reel/1122334455");
    expect(reel.vertical).toBe(true);
    expect(reel.url).toBe("https://www.facebook.com/reel/1122334455");
  });

  it("embeds a normal post with the post plugin (the video plays inside the post)", () => {
    const v = ok("https://www.facebook.com/mubazzar.ng/posts/pfbid02AbCdEf?__tn__=R");
    expect(v.embedUrl).toMatch(/plugins\/post\.php/);
    expect(href(v.embedUrl)).toBe("https://www.facebook.com/mubazzar.ng/posts/pfbid02AbCdEf");
    expect(ok("https://www.facebook.com/permalink.php?story_fbid=pfbid0x&id=100012345").embedUrl).toMatch(/post\.php/);
  });

  it("marks share links as short but keeps a usable embed", () => {
    for (const url of ["https://www.facebook.com/share/v/1AbCdE/", "https://www.facebook.com/share/r/1AbCdE/", "https://fb.watch/abcDEF12/"]) {
      const v = ok(url);
      expect(v.shortLink).toBe(true);
      expect(v.embedUrl).toMatch(/plugins\/video\.php/);
    }
    expect(ok("https://www.facebook.com/share/p/1AbCdE/").embedUrl).toMatch(/post\.php/);
  });

  it("explains links that aren't a post or video", () => {
    expect(videoLinkProblem("https://www.facebook.com/mubazzar.ng")).toMatch(/isn't a post or video/);
  });
});

describe("other platforms", () => {
  it("Instagram posts and reels, with or without a username", () => {
    for (const url of ["https://www.instagram.com/reel/C8xYz_12ab/?igsh=abc", "https://instagram.com/mubazzar.ng/reel/C8xYz_12ab/", "https://www.instagram.com/p/C8xYz_12ab/"]) {
      expect(ok(url).embedUrl).toBe("https://www.instagram.com/p/C8xYz_12ab/embed/");
    }
    expect(ok("https://www.instagram.com/share/reel/BAabc123/").shortLink).toBe(true);
    expect(videoLinkProblem("https://www.instagram.com/stories/mubazzar/123/")).toMatch(/24 hours/);
  });

  it("TikTok full and short links", () => {
    const v = ok("https://www.tiktok.com/@mubazzar.ng/video/7312345678901234567?is_from_webapp=1");
    expect(v.embedUrl).toBe("https://www.tiktok.com/embed/v2/7312345678901234567");
    expect(v.url).toBe("https://www.tiktok.com/@mubazzar.ng/video/7312345678901234567");
    expect(v.vertical).toBe(true);
    for (const url of ["https://vm.tiktok.com/ZMabc123/", "https://vt.tiktok.com/ZSabc123/", "https://www.tiktok.com/t/ZTabc123/"]) {
      const s = ok(url);
      expect(s.shortLink).toBe(true);
      expect(s.embedUrl).toBeNull();
    }
    expect(videoLinkProblem("https://www.tiktok.com/@mubazzar.ng/photo/7312345678901234567")).toMatch(/photo post/);
  });

  it("X / Twitter posts", () => {
    expect(ok("https://x.com/mubazzar/status/1812345678901234567?s=20").embedUrl).toBe(
      "https://platform.twitter.com/embed/Tweet.html?id=1812345678901234567&dnt=true",
    );
    expect(ok("https://twitter.com/mubazzar/status/1812345678901234567").platform).toBe("x");
  });

  it("YouTube Shorts are tall, normal videos are wide", () => {
    expect(ok("https://youtube.com/shorts/dQw4w9WgXcQ").vertical).toBe(true);
    expect(ok("https://youtu.be/dQw4w9WgXcQ").vertical).toBe(false);
  });

  it("names the platforms that cannot be embedded", () => {
    expect(videoLinkProblem("https://www.threads.net/@mubazzar/post/abc")).toMatch(/Threads videos can't be played/);
    expect(videoLinkProblem("https://wa.me/2348000000000")).toMatch(/WhatsApp/);
  });

  it("treats any other https link as a direct video file", () => {
    expect(ok("https://cdn.example.com/demo.mp4")).toMatchObject({ platform: "direct", embedUrl: null });
  });
});

describe("safety", () => {
  it("never builds an embed for a lookalike host", () => {
    expect(videoEmbedUrl("https://facebook.com.evil.example/reel/123456")).toBeNull();
    expect(videoEmbedUrl("https://evil.example/www.facebook.com/reel/123456")).toBeNull();
    expect(videoEmbedUrl("https://notfacebook.com/reel/123456")).toBeNull();
  });

  it("only ever embeds from the fixed player hosts", () => {
    const hosts = new Set(["www.facebook.com", "www.instagram.com", "www.tiktok.com", "platform.twitter.com"]);
    for (const url of [
      "https://www.facebook.com/x/videos/123456",
      'https://www.facebook.com/"><script>/posts/abc',
      "https://www.instagram.com/p/abcde/",
      "https://www.tiktok.com/@a/video/123456789",
      "https://x.com/a/status/123456",
    ]) {
      const e = videoEmbedUrl(url);
      if (e) expect(hosts.has(new URL(e).hostname)).toBe(true);
    }
  });

  it("rejects junk", () => {
    expect(parseVideoLink("not a url").ok).toBe(false);
    expect(parseVideoLink("javascript:alert(1)").ok).toBe(false);
    expect(parseVideoLink("").ok).toBe(false);
    expect(videoLinkProblem(null)).toBeNull();
  });
});
