import { describe, expect, it, vi } from "vitest";
import { expandShortVideoLink, normalizeVideoLink } from "./video-link";

const redirects = (map: Record<string, string>) =>
  vi.fn(async (url: string) => ({
    status: map[url] ? 302 : 200,
    headers: new Headers(map[url] ? { location: map[url] } : {}),
  }));

describe("expandShortVideoLink", () => {
  it("follows a share link to the full video", async () => {
    const f = redirects({
      "https://vm.tiktok.com/ZMabc/": "https://www.tiktok.com/t/ZMabc/",
      "https://www.tiktok.com/t/ZMabc/": "https://www.tiktok.com/@shop/video/7312345678901234567?_r=1",
    });
    expect(await expandShortVideoLink("https://vm.tiktok.com/ZMabc/", f)).toBe("https://www.tiktok.com/@shop/video/7312345678901234567");
  });

  it("never requests or follows a host outside the social allowlist", async () => {
    const f = redirects({ "https://vm.tiktok.com/x/": "https://169.254.169.254/latest/meta-data" });
    expect(await expandShortVideoLink("https://vm.tiktok.com/x/", f)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
    const g = redirects({});
    expect(await expandShortVideoLink("https://internal.example/x", g)).toBeNull();
    expect(g).not.toHaveBeenCalled();
    expect(await expandShortVideoLink("http://vm.tiktok.com/x/", g)).toBeNull();
    expect(g).not.toHaveBeenCalled();
  });

  it("gives up on redirect loops and network errors", async () => {
    const loop = vi.fn(async () => ({ status: 302, headers: new Headers({ location: "https://vm.tiktok.com/loop/" }) }));
    expect(await expandShortVideoLink("https://vm.tiktok.com/loop/", loop)).toBeNull();
    expect(loop).toHaveBeenCalledTimes(5);
    const down = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await expandShortVideoLink("https://vm.tiktok.com/x/", down)).toBeNull();
  });
});

describe("normalizeVideoLink", () => {
  const unused = vi.fn();

  it("removes tracking from full links without touching the network", async () => {
    expect(await normalizeVideoLink("https://www.facebook.com/reel/123456?mibextid=abc", unused)).toEqual({
      ok: true,
      url: "https://www.facebook.com/reel/123456",
    });
    expect(unused).not.toHaveBeenCalled();
  });

  it("passes through empty, direct and YouTube links", async () => {
    expect(await normalizeVideoLink(null, unused)).toEqual({ ok: true, url: null });
    expect(await normalizeVideoLink("https://cdn.example.com/a.mp4", unused)).toEqual({ ok: true, url: "https://cdn.example.com/a.mp4" });
    expect(await normalizeVideoLink("https://youtu.be/dQw4w9WgXcQ", unused)).toEqual({ ok: true, url: "https://youtu.be/dQw4w9WgXcQ" });
  });

  it("stores the expanded link", async () => {
    const f = redirects({ "https://www.facebook.com/share/v/1Ab/": "https://www.facebook.com/reel/998877?fs=e" });
    expect(await normalizeVideoLink("https://www.facebook.com/share/v/1Ab/", f)).toEqual({ ok: true, url: "https://www.facebook.com/reel/998877" });
  });

  it("keeps a Facebook share link when Facebook sends us to log in", async () => {
    const f = redirects({ "https://www.facebook.com/share/v/1Ab/": "https://www.facebook.com/login/?next=x" });
    expect(await normalizeVideoLink("https://www.facebook.com/share/v/1Ab/", f)).toEqual({ ok: true, url: "https://www.facebook.com/share/v/1Ab/" });
  });

  it("asks for the full link when a TikTok short link can't be opened", async () => {
    const r = await normalizeVideoLink("https://vm.tiktok.com/ZMabc/", redirects({}));
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/address bar/) });
  });
});
